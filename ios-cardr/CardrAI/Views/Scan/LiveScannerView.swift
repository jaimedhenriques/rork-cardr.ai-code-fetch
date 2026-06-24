import SwiftUI
import UIKit

/// Full-screen real-time scanner: live viewfinder, smart auto-capture, QR reading
/// and an optional batch tray. Returns captured images to the caller to read+enrich.
struct LiveScannerView: View {
    @Environment(\.dismiss) private var dismiss

    /// Called with one or more captured card images to read & enrich.
    let onCapture: ([UIImage]) -> Void
    /// Called with a QR/barcode payload read live from the viewfinder.
    let onCode: (String) -> Void

    @State private var scanner = LiveScannerService()
    @State private var batchMode = false
    @State private var flashFlash = false
    @State private var showTrayPop = false
    @State private var mode: ScanMode = .badge

    /// The three capture modes, mirroring the web scanner.
    enum ScanMode: String, CaseIterable, Identifiable {
        case badge, card, qr
        var id: String { rawValue }
        var label: String {
            switch self {
            case .badge: return "Event Badge"
            case .card: return "Paper Card"
            case .qr: return "LinkedIn QR"
            }
        }
        var icon: String {
            switch self {
            case .badge: return "checkmark.seal"
            case .card: return "creditcard"
            case .qr: return "qrcode"
            }
        }
        var instruction: String {
            switch self {
            case .badge: return "Capture the full badge, including all the text on it."
            case .card: return "Point at a paper card, then tap the capture button."
            case .qr: return "Point at any LinkedIn QR code to read it instantly."
            }
        }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if scanner.cameraAvailable && scanner.isAuthorized {
                CameraPreviewView(session: scanner.session)
                    .ignoresSafeArea()
                viewfinderOverlay
                captureFlash
                topBar
                bottomControls
                modeSelector
            } else {
                unavailableState
                closeButton
            }
        }
        .statusBarHidden()
        .task {
            await scanner.requestAccess()
            scanner.start()
        }
        .onDisappear { scanner.stop() }
        .onChange(of: scanner.lastCapture) { _, image in
            guard let image else { return }
            triggerFlash()
            if batchMode {
                scanner.capturedImages.append(image)
                withAnimation(.spring(response: 0.35, dampingFraction: 0.6)) { showTrayPop = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
                    scanner.lastCapture = nil
                    scanner.rearm()
                    showTrayPop = false
                }
            } else {
                let captured = image
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    scanner.stop()
                    dismiss()
                    onCapture([captured])
                }
            }
        }
        .onChange(of: scanner.detectedCode) { _, code in
            guard let code else { return }
            scanner.stop()
            dismiss()
            onCode(code)
        }
    }

    // MARK: - Mode selector

    private var modeSelector: some View {
        VStack {
            Spacer().frame(height: 64)
            HStack(spacing: 8) {
                ForEach(ScanMode.allCases) { item in
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { mode = item }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: item.icon)
                            Text(item.label)
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(mode == item ? Color.black : .white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            mode == item ? AnyShapeStyle(.white) : AnyShapeStyle(.ultraThinMaterial),
                            in: Capsule()
                        )
                    }
                }
            }
            Spacer()
        }
    }

    // MARK: - Viewfinder

    private var viewfinderOverlay: some View {
        GeometryReader { geo in
            let frameWidth = geo.size.width * 0.86
            let frameHeight = frameWidth * 0.62
            let rect = CGRect(
                x: (geo.size.width - frameWidth) / 2,
                y: (geo.size.height - frameHeight) / 2,
                width: frameWidth,
                height: frameHeight
            )
            ZStack {
                // Dim everything outside the card window.
                Color.black.opacity(0.5)
                    .mask(
                        Rectangle()
                            .overlay(
                                RoundedRectangle(cornerRadius: 22)
                                    .frame(width: frameWidth, height: frameHeight)
                                    .blendMode(.destinationOut)
                            )
                            .compositingGroup()
                    )

                ScanFrame(progress: scanner.framingProgress)
                    .frame(width: frameWidth, height: frameHeight)
                    .position(x: rect.midX, y: rect.midY)

                hint
                    .position(x: rect.midX, y: rect.maxY + 44)
            }
            .ignoresSafeArea()
        }
    }

    private var hint: some View {
        Text(scanner.framingProgress > 0.05 ? "Hold steady — capturing…" : mode.instruction)
            .font(.footnote.weight(.semibold))
            .multilineTextAlignment(.center)
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial, in: Capsule())
            .animation(.easeInOut, value: scanner.framingProgress > 0.05)
    }

    private var captureFlash: some View {
        Color.white
            .ignoresSafeArea()
            .opacity(flashFlash ? 0.9 : 0)
            .animation(.easeOut(duration: 0.35), value: flashFlash)
            .allowsHitTesting(false)
    }

    // MARK: - Top bar

    private var topBar: some View {
        VStack {
            HStack {
                roundButton("xmark") { scanner.stop(); dismiss() }
                Spacer()
                if scanner.cameraAvailable {
                    roundButton(scanner.torchOn ? "bolt.fill" : "bolt.slash") {
                        scanner.toggleTorch()
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            Spacer()
        }
    }

    // MARK: - Bottom controls

    private var bottomControls: some View {
        VStack {
            Spacer()
            VStack(spacing: 18) {
                batchToggle
                HStack(alignment: .center) {
                    trayThumbnails
                        .frame(maxWidth: .infinity, alignment: .leading)
                    shutterButton
                        .frame(maxWidth: .infinity, alignment: .center)
                    doneButton
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
                .padding(.horizontal, 24)
            }
            .padding(.bottom, 30)
        }
    }

    private var batchToggle: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { batchMode.toggle() }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: batchMode ? "square.stack.3d.up.fill" : "square.stack.3d.up")
                Text(batchMode ? "Batch mode on" : "Batch mode")
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(batchMode ? Color.black : .white)
            .padding(.horizontal, 16)
            .padding(.vertical, 9)
            .background(batchMode ? AnyShapeStyle(.white) : AnyShapeStyle(.ultraThinMaterial), in: Capsule())
        }
    }

    private var shutterButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            scanner.capturePhoto()
        } label: {
            ZStack {
                Circle().stroke(.white, lineWidth: 4).frame(width: 74, height: 74)
                Circle().fill(.white).frame(width: 60, height: 60)
                    .scaleEffect(scanner.isCapturing ? 0.8 : 1)
                    .animation(.spring(response: 0.25, dampingFraction: 0.6), value: scanner.isCapturing)
            }
        }
        .disabled(scanner.isCapturing)
    }

    @ViewBuilder
    private var trayThumbnails: some View {
        if batchMode, !scanner.capturedImages.isEmpty {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    ForEach(Array(scanner.capturedImages.suffix(3).enumerated()), id: \.offset) { index, image in
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 46, height: 34)
                            .clipShape(.rect(cornerRadius: 6))
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(.white, lineWidth: 1.5))
                            .rotationEffect(.degrees(Double(index - 1) * 6))
                            .offset(x: CGFloat(index) * 4)
                    }
                }
                Text("\(scanner.capturedImages.count)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: 20, height: 20)
                    .background(Theme.primary, in: Circle())
                    .offset(x: 10, y: -8)
            }
            .scaleEffect(showTrayPop ? 1.15 : 1)
        } else {
            Color.clear.frame(width: 46, height: 34)
        }
    }

    @ViewBuilder
    private var doneButton: some View {
        if batchMode, !scanner.capturedImages.isEmpty {
            Button {
                let images = scanner.capturedImages
                scanner.stop()
                dismiss()
                onCapture(images)
            } label: {
                Text("Save \(scanner.capturedImages.count)")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.black)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(.white, in: Capsule())
            }
        } else {
            Color.clear.frame(width: 46, height: 34)
        }
    }

    // MARK: - Helpers

    private func roundButton(_ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 42, height: 42)
                .background(.ultraThinMaterial, in: Circle())
        }
    }

    private func triggerFlash() {
        flashFlash = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { flashFlash = false }
    }

    // MARK: - Unavailable (simulator)

    private var unavailableState: some View {
        VStack(spacing: 16) {
            Image(systemName: "camera.metering.unknown")
                .font(.system(size: 50, weight: .light))
                .foregroundStyle(.white.opacity(0.7))
            Text("Camera not available here")
                .font(.headline)
                .foregroundStyle(.white)
            Text("Install this app on your device via the Rork App to use the live scanner.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.65))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
    }

    private var closeButton: some View {
        VStack {
            HStack {
                roundButton("xmark") { dismiss() }
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            Spacer()
        }
    }
}

/// The animated scan frame: brand corner brackets, a sweeping line, and a
/// progress ring that fills as the card becomes well-framed for auto-capture.
private struct ScanFrame: View {
    let progress: CGFloat
    @State private var sweep = false

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                RoundedRectangle(cornerRadius: 22)
                    .stroke(.white.opacity(0.25), lineWidth: 1)

                // Brand brackets that brighten with framing progress.
                ForEach(0..<4, id: \.self) { corner in
                    CornerBracket()
                        .stroke(Theme.primary, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .frame(width: 38, height: 38)
                        .rotationEffect(.degrees(Double(corner) * 90))
                        .position(cornerPosition(corner, w: w, h: h))
                        .opacity(0.5 + progress * 0.5)
                        .shadow(color: Theme.primary.opacity(progress), radius: 8)
                }

                // Sweeping scan line.
                RoundedRectangle(cornerRadius: 2)
                    .fill(
                        LinearGradient(
                            colors: [Theme.primary.opacity(0), Theme.accent, Theme.primary.opacity(0)],
                            startPoint: .leading, endPoint: .trailing
                        )
                    )
                    .frame(width: w * 0.82, height: 3)
                    .shadow(color: Theme.accent.opacity(0.8), radius: 6)
                    .position(x: w / 2, y: sweep ? h * 0.82 : h * 0.18)
                    .animation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true), value: sweep)
            }
        }
        .onAppear { sweep = true }
    }

    private func cornerPosition(_ corner: Int, w: CGFloat, h: CGFloat) -> CGPoint {
        let inset: CGFloat = 22
        switch corner {
        case 0: return CGPoint(x: inset, y: inset)
        case 1: return CGPoint(x: w - inset, y: inset)
        case 2: return CGPoint(x: w - inset, y: h - inset)
        default: return CGPoint(x: inset, y: h - inset)
        }
    }
}

/// An L-shaped corner bracket path.
private struct CornerBracket: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        return path
    }
}
