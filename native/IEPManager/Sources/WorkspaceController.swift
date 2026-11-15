import Foundation
import SwiftUI
import UniformTypeIdentifiers

@MainActor @Observable
final class WorkspaceController {
    var workspace = NativeWorkspace()
    var locked = true
    var busy = false
    var message = ""
    let vault: Vault
    init(vault: Vault? = nil) {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("PrivateIEP", isDirectory: true)
        var selectedVault = vault ?? Vault(url: directory.appendingPathComponent("workspace.iepvault"), keys: DeviceKey(account: "primary-v1"))
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        if let index = arguments.firstIndex(of: "-test-vault"), arguments.indices.contains(index + 1), let id = UUID(uuidString: arguments[index + 1]) {
            selectedVault = Vault(url: directory.appendingPathComponent("UITests").appendingPathComponent(id.uuidString).appendingPathComponent("workspace.iepvault"), keys: DeviceKey(account: "uitest-" + id.uuidString))
        }
        if ProcessInfo.processInfo.arguments.contains("-inject-save-failure") {
            selectedVault.write = { _, _ in throw NativeError.locked }
        }
        #endif
        self.vault = selectedVault
        reload()
    }
    func reload() {
        do { workspace = try vault.load(); locked = false; message = "Encrypted local workspace ready" }
        catch { locked = true; workspace = NativeWorkspace(); message = NativeError.locked.localizedDescription }
    }
    func commit(_ next: NativeWorkspace) {
        guard !locked else { return }
        do { try vault.save(next); workspace = next; message = "Saved encrypted on this device" }
        catch { message = "Save failed. Existing workspace preserved." }
    }
    func importData(_ data: Data, name: String) async {
        guard !locked, !busy else { return }
        busy = true; defer { busy = false }
        do {
            guard !workspace.sources.contains(where: {$0.sha256 == digest(data)}) else { message = "Duplicate source: original bytes already preserved. No new evidence added."; return }
            let source = try await Task.detached { try LocalOCR.recognize(data, name: name) }.value
            var next = workspace; next.sources.append(source); commit(next)
        } catch { message = error.localizedDescription }
    }
    func importURL(_ url: URL) async {
        let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
        do { let data = try Data(contentsOf: url); await importData(data, name: url.lastPathComponent) }
        catch { message = "Unable to read selected local file." }
    }
    func addGoal(_ goal: Goal) { var next = workspace; next.goals.append(goal); commit(next) }
    func modelDraft(_ source: SourceRecord) async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do { addGoal(try await LocalModel.propose(source)) }
        catch let error as NativeError { message = error.localizedDescription }
        catch { message = "On-device model generation failed. No draft accepted; manual source review remains available." }
    }
    func restore(_ data: Data, password: String) {
        guard !locked else { message = NativeError.locked.localizedDescription; return }
        do { workspace = try vault.restore(data, password: password); message = "Authenticated backup restored locally" }
        catch { message = "Restore rejected. Wrong password, damaged archive, or unavailable key. Existing vault preserved." }
    }
}
struct EncryptedDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.data] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}
