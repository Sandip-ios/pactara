import Capacitor
import Photos
import UIKit
import UniformTypeIdentifiers
import AVFoundation

@objc(PactaraPhotoLibraryPlugin)
public class PactaraPhotoLibraryPlugin: CAPPlugin, CAPBridgedPlugin, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public let identifier = "PactaraPhotoLibraryPlugin"
    public let jsName = "PactaraPhotoLibrary"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRecents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "capture", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]
    private var cameraCall: CAPPluginCall?

    @objc func requestPermissions(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            call.resolve(["photos": status == .authorized ? "granted" : status == .limited ? "limited" : "denied"])
        }
    }

    @objc func getRecents(_ call: CAPPluginCall) {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard status == .authorized || status == .limited else { call.reject("Photo access denied"); return }
        DispatchQueue.global(qos: .userInitiated).async {
            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            options.fetchLimit = min(120, max(1, call.getInt("limit") ?? 60))
            options.predicate = NSPredicate(format: "mediaType == %d OR mediaType == %d", PHAssetMediaType.image.rawValue, PHAssetMediaType.video.rawValue)
            let assets = PHAsset.fetchAssets(with: options)
            let request = PHImageRequestOptions()
            request.isSynchronous = true
            request.deliveryMode = .fastFormat
            request.resizeMode = .fast
            // Grid thumbnails stay local; full/iCloud media is fetched only when selected.
            request.isNetworkAccessAllowed = false
            var rows: [JSObject] = []
            assets.enumerateObjects { asset, _, _ in
                var thumbnail = ""
                PHImageManager.default().requestImage(for: asset, targetSize: CGSize(width: 300, height: 300), contentMode: .aspectFill, options: request) { image, _ in
                    if let data = image?.jpegData(compressionQuality: 0.75) { thumbnail = "data:image/jpeg;base64," + data.base64EncodedString() }
                }
                rows.append([
                    "id": asset.localIdentifier,
                    "thumbnail": thumbnail,
                    "kind": asset.mediaType == .video ? "video" : "photo",
                    "createdAt": ISO8601DateFormatter().string(from: asset.creationDate ?? .distantPast),
                    "duration": asset.mediaType == .video ? asset.duration as Any : NSNull() as Any
                ])
            }
            call.resolve(["assets": rows])
        }
    }

    private func photoResult(_ image: UIImage, call: CAPPluginCall, camera: Bool = false) {
        guard let data = image.jpegData(compressionQuality: 0.95) else { call.reject("Could not read photo"); return }
        let name = UUID().uuidString + ".jpg"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        do {
            try data.write(to: url)
            let file: JSObject = ["path": url.absoluteString, "name": name, "mimeType": "image/jpeg"]
            call.resolve(camera ? ["cancelled": false, "file": file] : file)
        } catch { call.reject("Could not read photo", nil, error) }
    }

    @objc func getMedia(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
            call.reject("Photo or video is no longer available"); return
        }
        if asset.mediaType == .video {
            let options = PHVideoRequestOptions()
            options.isNetworkAccessAllowed = true
            options.deliveryMode = .highQualityFormat
            PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, _ in
                guard let avAsset = avAsset,
                      let export = AVAssetExportSession(asset: avAsset, presetName: AVAssetExportPresetHighestQuality) else { call.reject("Could not read video"); return }
                let name = UUID().uuidString + ".mp4"
                let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
                export.outputURL = url
                export.outputFileType = .mp4
                export.exportAsynchronously {
                    guard export.status == .completed else { call.reject("Could not export video"); return }
                    call.resolve(["path": url.absoluteString, "name": name, "mimeType": "video/mp4"])
                }
            }
        } else {
            let options = PHImageRequestOptions()
            options.isNetworkAccessAllowed = true
            options.deliveryMode = .highQualityFormat
            PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, _ in
                guard let data = data, let image = UIImage(data: data) else { call.reject("Could not read photo"); return }
                self.photoResult(image, call: call)
            }
        }
    }

    @objc func capture(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.cameraCall == nil else { call.reject("Camera is already open"); return }
            guard UIImagePickerController.isSourceTypeAvailable(.camera), let presenter = self.bridge?.viewController else {
                call.reject("Camera unavailable"); return
            }
            self.cameraCall = call
            self.bridge?.saveCall(call)
            let picker = UIImagePickerController()
            picker.sourceType = .camera
            picker.mediaTypes = [UTType.image.identifier, UTType.movie.identifier]
            picker.delegate = self
            presenter.present(picker, animated: true)
        }
    }

    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        cameraCall?.resolve(["cancelled": true])
        if let call = cameraCall { bridge?.releaseCall(call) }
        cameraCall = nil
    }

    public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)
        guard let call = cameraCall else { return }
        defer { bridge?.releaseCall(call); cameraCall = nil }
        if let url = info[.mediaURL] as? URL {
            call.resolve(["cancelled": false, "file": ["path": url.absoluteString, "name": url.lastPathComponent, "mimeType": "video/quicktime"]])
        } else if let image = info[.originalImage] as? UIImage {
            photoResult(image, call: call, camera: true)
        } else { call.reject("Could not read camera capture") }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { call.reject("Settings unavailable"); return }
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened { call.resolve() } else { call.reject("Settings unavailable") }
            }
        }
    }
}
