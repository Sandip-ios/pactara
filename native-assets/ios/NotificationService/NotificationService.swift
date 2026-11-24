import Intents
import UserNotifications

/// Pactara Notification Service Extension.
///
/// Turns a check-in push into an iOS "communication" notification: the sender's
/// photo as the big icon (small Pactara badge in the corner) and the check-in
/// thumbnail on the right. The server sets `mutable-content: 1` and these data keys:
/// `image_url`, `sender_id`, `sender_name`, `sender_avatar_url`, `thread_id`, `kind`.
///
/// Any failure or timeout delivers the original notification unchanged.
final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var originalContent: UNNotificationContent?
    private var finished = false
    private let lock = NSLock()

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 20
        return URLSession(configuration: config)
    }()

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        self.originalContent = request.content

        guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
            deliver(request.content)
            return
        }

        let info = request.content.userInfo
        let imageURL = Self.url(info["image_url"])
        let avatarURL = Self.url(info["sender_avatar_url"])
        let senderName = Self.string(info["sender_name"])
        let senderId = Self.string(info["sender_id"]) ?? senderName ?? "sender"
        let threadId = Self.string(info["thread_id"])

        var attachment: UNNotificationAttachment?
        var avatarData: Data?
        let group = DispatchGroup()

        // a) Right-side thumbnail (check-in photo or video poster frame).
        if let imageURL = imageURL {
            group.enter()
            downloadAttachment(from: imageURL) { result in
                attachment = result
                group.leave()
            }
        }

        // b) Sender photo for the big icon (no photo: initials-style default).
        if senderName != nil, let avatarURL = avatarURL {
            group.enter()
            session.dataTask(with: avatarURL) { data, response, _ in
                if let data = data, !data.isEmpty, (response as? HTTPURLResponse)?.statusCode == 200 {
                    avatarData = data
                }
                group.leave()
            }.resume()
        }

        group.notify(queue: .global(qos: .userInitiated)) { [weak self] in
            guard let self = self else { return }
            if let attachment = attachment {
                content.attachments = [attachment]
            }

            guard let name = senderName else {
                self.deliver(content)
                return
            }
            guard #available(iOSApplicationExtension 15.0, *) else {
                self.deliver(content)
                return
            }

            let personImage = avatarData.map { INImage(imageData: $0) }
            let person = INPerson(
                personHandle: INPersonHandle(value: senderId, type: .unknown),
                nameComponents: nil,
                displayName: name,
                image: personImage,
                contactIdentifier: nil,
                customIdentifier: senderId
            )
            let intent = INSendMessageIntent(
                recipients: nil,
                outgoingMessageType: .outgoingMessageText,
                content: content.body,
                speakableGroupName: nil,
                conversationIdentifier: threadId,
                serviceName: nil,
                sender: person,
                attachments: nil
            )
            if let personImage = personImage {
                intent.setImage(personImage, forParameterNamed: \.sender)
            }

            let interaction = INInteraction(intent: intent, response: nil)
            interaction.direction = .incoming
            interaction.donate { _ in
                // A failed donation still lets us try the communication style.
                do {
                    let updated = try content.updating(from: intent)
                    self.deliver(updated)
                } catch {
                    self.deliver(content)
                }
            }
        }
    }

    /// c) iOS is about to give up on us: show the original notification unchanged.
    override func serviceExtensionTimeWillExpire() {
        if let original = originalContent {
            deliver(original)
        }
    }

    // MARK: - Helpers

    /// Calls the content handler exactly once.
    private func deliver(_ content: UNNotificationContent) {
        lock.lock()
        let alreadyDone = finished
        finished = true
        lock.unlock()
        guard !alreadyDone else { return }
        contentHandler?(content)
    }

    private func downloadAttachment(from url: URL, completion: @escaping (UNNotificationAttachment?) -> Void) {
        session.downloadTask(with: url) { tempURL, response, _ in
            guard
                let tempURL = tempURL,
                (response as? HTTPURLResponse)?.statusCode == 200
            else {
                completion(nil)
                return
            }
            let ext: String
            switch response?.mimeType?.lowercased() {
            case "image/png": ext = "png"
            case "image/gif": ext = "gif"
            case "image/heic": ext = "heic"
            default: ext = "jpg"
            }
            let target = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension(ext)
            do {
                try FileManager.default.moveItem(at: tempURL, to: target)
                let attachment = try UNNotificationAttachment(identifier: "checkin-thumbnail", url: target, options: nil)
                completion(attachment)
            } catch {
                completion(nil)
            }
        }.resume()
    }

    private static func string(_ value: Any?) -> String? {
        guard let s = value as? String else { return nil }
        let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func url(_ value: Any?) -> URL? {
        guard let s = string(value), let url = URL(string: s), url.scheme?.lowercased() == "https" else { return nil }
        return url
    }
}
