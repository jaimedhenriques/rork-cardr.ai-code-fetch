import SwiftUI
import MessageUI

/// A native in-app email composer wrapping `MFMailComposeViewController`,
/// mirroring the web `EmailComposer`. Falls back gracefully when mail isn't set up.
struct MailComposer: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss

    let recipients: [String]
    var subject: String = ""
    var body: String = ""

    static var canSendMail: Bool { MFMailComposeViewController.canSendMail() }

    func makeUIViewController(context: Context) -> MFMailComposeViewController {
        let controller = MFMailComposeViewController()
        controller.mailComposeDelegate = context.coordinator
        controller.setToRecipients(recipients)
        controller.setSubject(subject)
        controller.setMessageBody(body, isHTML: false)
        return controller
    }

    func updateUIViewController(_ controller: MFMailComposeViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, MFMailComposeViewControllerDelegate {
        let parent: MailComposer
        init(_ parent: MailComposer) { self.parent = parent }

        func mailComposeController(
            _ controller: MFMailComposeViewController,
            didFinishWith result: MFMailComposeResult,
            error: Error?
        ) {
            parent.dismiss()
        }
    }
}
