import SwiftUI
import PhotosUI
import UIKit

/// White-label branding editor mirroring the web `BrandingEditor`: app name,
/// tagline, brand colors, and logo/favicon/splash uploads, with a live preview.
struct BrandingEditorView: View {
    @Environment(DataStore.self) private var data

    @State private var appName = ""
    @State private var tagline = ""
    @State private var primaryColor = OrgBranding.default.primaryColor
    @State private var accentColor = OrgBranding.default.accentColor
    @State private var dirty = false
    @State private var saving = false
    @State private var uploading: String?
    @State private var didSync = false

    @State private var logoItem: PhotosPickerItem?
    @State private var faviconItem: PhotosPickerItem?
    @State private var splashItem: PhotosPickerItem?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            editorCard
            previewCard
        }
        .task {
            if data.branding.id == nil { await data.loadBranding() }
            syncFromBranding()
        }
        .onChange(of: data.branding) { _, _ in
            if !dirty { syncFromBranding() }
        }
        .onChange(of: logoItem) { _, item in upload(item, type: "logo") }
        .onChange(of: faviconItem) { _, item in upload(item, type: "favicon") }
        .onChange(of: splashItem) { _, item in upload(item, type: "splash") }
    }

    private var editorCard: some View {
        CardSurface(padding: 18) {
            VStack(alignment: .leading, spacing: 16) {
                Label("White-Label Branding", systemImage: "paintbrush.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Text("Customize the app to match your company brand. Members of your organization will see these changes.")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.inkSecondary)

                fieldGroup
                colorGroup
                assetGroup
                actionRow
            }
        }
    }

    private var fieldGroup: some View {
        VStack(alignment: .leading, spacing: 12) {
            labeledField("App Name", icon: "textformat", text: $appName, placeholder: "CardrAI")
            labeledField("Tagline", icon: "text.quote", text: $tagline, placeholder: "Scan. Remember. Close.")
        }
    }

    private func labeledField(_ label: String, icon: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(label.uppercased(), systemImage: icon)
                .font(.system(size: 10, weight: .semibold))
                .tracking(1)
                .foregroundStyle(Theme.inkSecondary)
            TextField(placeholder, text: text)
                .textFieldStyle(.roundedBorder)
                .onChange(of: text.wrappedValue) { _, _ in dirty = true }
        }
    }

    private var colorGroup: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("BRAND COLORS", systemImage: "paintpalette.fill")
                .font(.system(size: 10, weight: .semibold))
                .tracking(1)
                .foregroundStyle(Theme.inkSecondary)
            colorRow("Primary", hsl: $primaryColor)
            colorRow("Accent", hsl: $accentColor)
        }
    }

    private func colorRow(_ label: String, hsl: Binding<String>) -> some View {
        HStack(spacing: 12) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.inkSecondary)
                .frame(width: 70, alignment: .leading)
            ColorPicker("", selection: Binding(
                get: { Color(hslString: hsl.wrappedValue) },
                set: { hsl.wrappedValue = $0.hslString; dirty = true }
            ), supportsOpacity: false)
            .labelsHidden()
            Text(hsl.wrappedValue)
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(Theme.inkSecondary)
            Spacer()
        }
    }

    private var assetGroup: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("ASSETS", systemImage: "photo.fill")
                .font(.system(size: 10, weight: .semibold))
                .tracking(1)
                .foregroundStyle(Theme.inkSecondary)
            assetRow("Logo (recommended 200×50 PNG)", url: data.branding.logoUrl, type: "logo", selection: $logoItem)
            assetRow("Favicon (32×32 PNG)", url: data.branding.faviconUrl, type: "favicon", selection: $faviconItem)
            assetRow("Splash Screen (1080×1920 PNG)", url: data.branding.splashUrl, type: "splash", selection: $splashItem)
        }
    }

    private func assetRow(_ label: String, url: String?, type: String, selection: Binding<PhotosPickerItem?>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.inkSecondary)
            if let url, let imageURL = URL(string: url), !url.isEmpty {
                AsyncImage(url: imageURL) { image in
                    image.resizable().aspectRatio(contentMode: .fit)
                } placeholder: {
                    ProgressView()
                }
                .frame(maxWidth: 200, maxHeight: 56, alignment: .leading)
                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            PhotosPicker(selection: selection, matching: .images) {
                HStack(spacing: 6) {
                    if uploading == type {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                    }
                    Text(url?.isEmpty == false ? "Replace" : "Upload")
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.primary)
            }
            .disabled(uploading != nil || !data.canEditBranding)
        }
    }

    private var actionRow: some View {
        HStack(spacing: 10) {
            Button {
                Task {
                    saving = true
                    await data.resetBranding()
                    syncFromBranding()
                    saving = false
                }
            } label: {
                Label("Reset", systemImage: "arrow.counterclockwise")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.inkSecondary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)
                    .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .disabled(saving || !data.canEditBranding)

            Button(action: save) {
                HStack(spacing: 6) {
                    if saving { ProgressView().tint(.white) } else { Image(systemName: "checkmark") }
                    Text("Save Branding")
                }
                .font(.system(size: 14, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .foregroundStyle(.white)
                .background(Theme.brandGradient, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(saving || !dirty || !data.canEditBranding)
        }
    }

    private var previewCard: some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                Text("PREVIEW")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1)
                    .foregroundStyle(Theme.inkSecondary)
                HStack(spacing: 12) {
                    if let logo = data.branding.logoUrl, let url = URL(string: logo), !logo.isEmpty {
                        AsyncImage(url: url) { image in
                            image.resizable().aspectRatio(contentMode: .fit)
                        } placeholder: { Color.clear }
                        .frame(width: 44, height: 44)
                    } else {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color(hslString: primaryColor))
                            .frame(width: 44, height: 44)
                            .overlay {
                                Text(String(appName.first ?? "C"))
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(appName.isEmpty ? "CardrAI" : appName)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Theme.ink)
                        Text(tagline.isEmpty ? "Scan. Remember. Close." : tagline)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    Spacer()
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hslString: primaryColor).opacity(0.1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    // MARK: - Logic

    private func syncFromBranding() {
        let b = data.branding
        appName = b.appName
        tagline = b.tagline
        primaryColor = b.primaryColor
        accentColor = b.accentColor
        dirty = false
        didSync = true
    }

    private func save() {
        saving = true
        var draft = BrandingDraft(from: data.branding)
        draft.appName = appName.trimmingCharacters(in: .whitespaces)
        draft.tagline = tagline.trimmingCharacters(in: .whitespaces)
        draft.primaryColor = primaryColor
        draft.accentColor = accentColor
        Task {
            let ok = await data.saveBranding(draft)
            if ok { dirty = false }
            saving = false
        }
    }

    private func upload(_ item: PhotosPickerItem?, type: String) {
        guard let item else { return }
        uploading = type
        Task {
            defer { uploading = nil }
            guard let data0 = try? await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data0),
                  let png = image.pngData() else { return }
            _ = await data.uploadBrandingAsset(png, fileExtension: "png", contentType: "image/png", type: type)
        }
    }
}
