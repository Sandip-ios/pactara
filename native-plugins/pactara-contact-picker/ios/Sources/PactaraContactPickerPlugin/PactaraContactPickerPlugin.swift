import Capacitor
import Contacts
import ContactsUI
import UIKit

@objc(PactaraContactPickerPlugin)
public class PactaraContactPickerPlugin: CAPPlugin, CAPBridgedPlugin, CNContactPickerDelegate {
    public let identifier = "PactaraContactPickerPlugin"
    public let jsName = "PactaraContactPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickContact", returnType: CAPPluginReturnPromise)
    ]

    private var pickContactCallbackId: String?

    @objc func pickContact(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.bridge?.saveCall(call)
            self.pickContactCallbackId = call.callbackId

            let picker = CNContactPickerViewController()
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func contactPicker(_ picker: CNContactPickerViewController, didSelect contact: CNContact) {
        resolveSavedCall(contact: contact, cancelled: false)
    }

    public func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
        resolveSavedCall(contact: nil, cancelled: true)
    }

    private func resolveSavedCall(contact: CNContact?, cancelled: Bool) {
        guard let callbackId = pickContactCallbackId,
              let call = bridge?.savedCall(withID: callbackId) else {
            pickContactCallbackId = nil
            return
        }

        if cancelled {
            call.resolve(["cancelled": true])
        } else if let contact = contact {
            let givenName = contact.givenName.trimmingCharacters(in: .whitespacesAndNewlines)
            let familyName = contact.familyName.trimmingCharacters(in: .whitespacesAndNewlines)
            let formattedName = CNContactFormatter.string(from: contact, style: .fullName)?.trimmingCharacters(in: .whitespacesAndNewlines)
            let fallbackName = [givenName, familyName].filter { !$0.isEmpty }.joined(separator: " ")
            let name = formattedName?.isEmpty == false ? formattedName! : fallbackName

            call.resolve([
                "cancelled": false,
                "name": name,
                "givenName": givenName,
                "familyName": familyName
            ])
        } else {
            call.resolve(["cancelled": true])
        }

        bridge?.releaseCall(call)
        pickContactCallbackId = nil
    }
}