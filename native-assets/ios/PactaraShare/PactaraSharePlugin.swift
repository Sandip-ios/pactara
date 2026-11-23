import Capacitor
import Photos
import UIKit

/// "Share your win" native helpers (JS name: PactaraShare, see src/lib/native-share.ts).
/// - saveVideo: writes the rendered MP4 straight to Photos.
/// - canShareToStories / shareToStories: Meta "Sharing to Stories" for
///   Instagram and Facebook (video background + movable sticker).
@objc(PactaraSharePlugin)
public class PactaraSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PactaraSharePlugin"
    public let jsName = "PactaraShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "canShareToStories", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareToStories", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveVideo", returnType: CAPPluginReturnPromise),
    ]

    private func scheme(_ app: String) -> String {
        app == "facebook" ? "facebook-stories" : "instagram-stories"
    }

    @objc func canShareToStories(_ call: CAPPluginCall) {
        let app = call.getString("app") ?? "instagram"
        DispatchQueue.main.async {
            guard let url = URL(string: "\(self.scheme(app))://share") else {
                call.resolve(["available": false]); return
            }
            call.resolve(["available": UIApplication.shared.canOpenURL(url)])
        }
    }

    @objc func shareToStories(_ call: CAPPluginCall) {
        let app = call.getString("app") ?? "instagram"
        guard let appId = call.getString("appId"), !appId.isEmpty else {
            call.reject("Missing Meta App ID"); return
        }
        guard let b64 = call.getString("backgroundVideo"),
              let video = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else {
            call.reject("Missing video"); return
        }
        let sticker = call.getString("stickerImage").flatMap { Data(base64Encoded: $0, options: .ignoreUnknownCharacters) }
        let prefix = app == "facebook" ? "com.facebook.sharedSticker" : "com.instagram.sharedSticker"
        var item: [String: Any] = [
            "\(prefix).backgroundVideo": video,
            "\(prefix).backgroundTopColor": call.getString("topColor") ?? "#141218",
            "\(prefix).backgroundBottomColor": call.getString("bottomColor") ?? "#141218",
        ]
        if let sticker { item["\(prefix).stickerImage"] = sticker }
        if app == "facebook" { item["com.facebook.sharedSticker.appID"] = appId }

        guard let url = URL(string: "\(scheme(app))://share?source_application=\(appId)") else {
            call.reject("Bad URL"); return
        }
        DispatchQueue.main.async {
            guard UIApplication.shared.canOpenURL(url) else {
                call.reject("App not installed", "NOT_INSTALLED"); return
            }
            UIPasteboard.general.setItems([item], options: [.expirationDate: Date().addingTimeInterval(300)])
            UIApplication.shared.open(url, options: [:]) { ok in
                ok ? call.resolve() : call.reject("Couldn't open the app")
            }
        }
    }

    @objc func saveVideo(_ call: CAPPluginCall) {
        guard let b64 = call.getString("data"),
              let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else {
            call.reject("Missing video"); return
        }
        let name = (call.getString("fileName") ?? "Pactara.mp4").replacingOccurrences(of: "/", with: "-")
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        do {
            try? FileManager.default.removeItem(at: fileURL)
            try data.write(to: fileURL)
        } catch {
            call.reject("Couldn't write the video"); return
        }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                try? FileManager.default.removeItem(at: fileURL)
                call.reject("Photos access was denied", "DENIED"); return
            }
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: fileURL)
            }) { ok, error in
                try? FileManager.default.removeItem(at: fileURL)
                ok ? call.resolve() : call.reject(error?.localizedDescription ?? "Couldn't save the video")
            }
        }
    }
}
