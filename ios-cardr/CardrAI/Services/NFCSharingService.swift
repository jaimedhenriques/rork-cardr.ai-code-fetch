import Foundation
import Observation
import CoreNFC

/// Writes the user's digital-card link to a programmable NFC tag so it can be
/// shared with a tap (the same mechanism Popl's physical products use).
///
/// CoreNFC is only available on physical iPhones with an NFC chip; on the
/// simulator `NFCNDEFReaderSession.readingAvailable` is `false`, so the UI
/// hides the action and shows a "use a real device" hint instead.
@MainActor
@Observable
final class NFCSharingService: NSObject {
    enum Status: Equatable {
        case idle
        case scanning
        case success
        case failure(String)
    }

    var status: Status = .idle

    /// Whether the running device can read/write NFC tags at all.
    static var isAvailable: Bool { NFCNDEFReaderSession.readingAvailable }

    private var session: NFCNDEFReaderSession?
    private var payloadURL: URL?

    /// Starts a session that writes `link` to the next NFC tag held to the phone.
    func writeCardLink(_ link: String) {
        guard Self.isAvailable else {
            status = .failure("NFC isn't available on this device.")
            return
        }
        guard let url = URL(string: link) else {
            status = .failure("Your card link isn't valid yet.")
            return
        }
        payloadURL = url
        status = .scanning
        let session = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: false)
        session.alertMessage = "Hold your iPhone near an NFC tag to write your card link."
        session.begin()
        self.session = session
    }

    func reset() {
        status = .idle
    }
}

extension NFCSharingService: NFCNDEFReaderSessionDelegate {
    nonisolated func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        // Required by the protocol; writing happens in didDetect tags below.
    }

    nonisolated func readerSession(_ session: NFCNDEFReaderSession, didDetect tags: [NFCNDEFTag]) {
        guard let tag = tags.first else { return }
        let url = MainActor.assumeIsolated { self.payloadURL }

        session.connect(to: tag) { connectError in
            if let connectError {
                session.invalidate(errorMessage: connectError.localizedDescription)
                return
            }
            guard let url, let payload = NFCNDEFPayload.wellKnownTypeURIPayload(url: url) else {
                session.invalidate(errorMessage: "Couldn't build the card link.")
                return
            }
            let message = NFCNDEFMessage(records: [payload])
            tag.writeNDEF(message) { writeError in
                if let writeError {
                    session.invalidate(errorMessage: writeError.localizedDescription)
                } else {
                    session.alertMessage = "Card link written. Anyone who taps this tag opens your card."
                    session.invalidate()
                    Task { @MainActor in self.status = .success }
                }
            }
        }
    }

    nonisolated func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        Task { @MainActor in
            if case .success = self.status { return }
            let nfcError = error as? NFCReaderError
            if nfcError?.code == .readerSessionInvalidationErrorUserCanceled
                || nfcError?.code == .readerSessionInvalidationErrorFirstNDEFTagRead {
                self.status = .idle
            } else {
                self.status = .failure(error.localizedDescription)
            }
        }
    }
}
