import SwiftUI
import AVFoundation
import UniformTypeIdentifiers

@main
struct IEPManagerApp: App {
    @State private var controller = WorkspaceController()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            RootView(controller: controller)
                .overlay { if phase != .active { Color(.systemBackground).overlay { Text("IEP Manager — protected workspace") } } }
        }
    }
}
struct RootView: View {
    @Bindable var controller: WorkspaceController
    var body: some View {
        VStack(spacing: 0) {
            Text("LOCAL SYNTHETIC CANDIDATE").font(.caption.bold()).padding(6)
            if controller.locked {
                ContentUnavailableView("Vault locked", systemImage: "lock.shield", description: Text(controller.message))
                Button("Retry unlock") { controller.reload() }.padding()
            } else {
                TabView {
                    NavigationStack { WorkspaceView(controller: controller) }.tabItem { Label("Workspace", systemImage: "person.crop.rectangle") }
                    NavigationStack { SourcesView(controller: controller) }.tabItem { Label("Sources", systemImage: "doc.viewfinder") }
                    NavigationStack { RecoveryView(controller: controller) }.tabItem { Label("Recovery", systemImage: "lock.rotation") }
                }
            }
            if controller.busy { ProgressView("Processing on device").padding(5) }
            Text(controller.message).font(.caption).padding(8).frame(maxWidth: .infinity).background(.thinMaterial).accessibilityIdentifier("status")
        }
    }
}
struct SourcesView: View {
    @Bindable var controller: WorkspaceController
    @State private var importing = false
    @State private var camera = false
    var body: some View {
        List {
            Section("Intake stays on this device") {
                Button("Import local file") { importing = true }.accessibilityIdentifier("importFile")
                Button("Capture worksheet") { Task { await openCamera() } }.accessibilityIdentifier("camera")
                Button("Load synthetic worksheet") { Task { await controller.importData(LocalOCR.syntheticWorksheet(), name: "synthetic-worksheet.png") } }.accessibilityIdentifier("synthetic")
                Text("PDF, image, or UTF-8 text. Vision OCR runs locally. Choose On My iPhone/iPad; no cloud provider is configured by this app.").font(.caption)
            }
            Section("Preserved originals") {
                ForEach(controller.workspace.sources) { source in
                    NavigationLink { SourceReview(controller: controller, sourceID: source.id) } label: {
                        VStack(alignment: .leading) { Text(source.name); Text("\(source.lines.count) source lines · \(source.method)").font(.caption) }
                    }
                }
            }
            Section("Inference capability") { Text(LocalModel.status).accessibilityIdentifier("modelStatus"); Text("Unavailable models never fall back to a remote service or a simulated model.").font(.caption) }
        }.navigationTitle("Sources").disabled(controller.busy)
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf, .image, .plainText]) { result in
            if case .success(let url) = result { Task { await controller.importURL(url) } }
            else { controller.message = "Import cancelled or unavailable. Existing records preserved." }
        }
        .sheet(isPresented: $camera) { CameraCapture { data in Task { await controller.importData(data, name: "camera-worksheet.jpg") } } }
    }
    private func openCamera() async {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else { controller.message = "Camera unavailable on this device or simulator. Import a local image instead."; return }
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        let allowed = status == .authorized ? true : status == .notDetermined ? await AVCaptureDevice.requestAccess(for: .video) : false
        if allowed { camera = true } else { controller.message = "Camera permission denied or restricted. Use local file import; permissions were not changed." }
    }
}
struct SourceReview: View {
    @Bindable var controller: WorkspaceController
    let sourceID: UUID
    @State private var correction = ""
    var source: SourceRecord? { controller.workspace.sources.first {$0.id == sourceID} }
    var body: some View {
        if let source {
            List {
                Section("Original source") {
                    if let image = UIImage(data: source.original) { Image(uiImage: image).resizable().scaledToFit().accessibilityLabel("Preserved source image") }
                    Text(source.name); Text("SHA-256: \(source.sha256)").font(.caption).textSelection(.enabled)
                }
                Section("Review OCR; confidence is not correctness") {
                    ForEach(source.lines) { line in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Page \(line.page) · OCR \(Int(line.confidence * 100))%").font(.caption)
                            Text(line.text).textSelection(.enabled)
                            Button("Use this source line as draft") {
                                do { controller.addGoal(try LocalModel.groundedGoal(quote: line.text, source: source)) } catch { controller.message = error.localizedDescription }
                            }.font(.caption)
                        }
                    }
                }
                Section("Human correction — original retained") {
                    TextEditor(text: $correction).frame(minHeight: 120).accessibilityLabel("Reviewed source text")
                    Button("Save correction") { var next = controller.workspace; if let i = next.sources.firstIndex(where: {$0.id == sourceID}) { next.sources[i].reviewedText = correction; controller.commit(next) } }
                }
                Section("Model proposal") {
                    Text(LocalModel.status)
                    Button("Propose with on-device model") { Task { await controller.modelDraft(source) } }.disabled(controller.busy)
                    Text("Only exact source quotations pass validation. All proposals remain drafts until human approval.").font(.caption)
                }
            }.navigationTitle("Review source").onAppear { correction = source.reviewedText }
        }
    }
}
struct WorkspaceView: View {
    @Bindable var controller: WorkspaceController
    @State private var name = ""
    @State private var report = ""
    var body: some View {
        List {
            Section("Student / plan") {
                TextField("Student name", text: $name).accessibilityIdentifier("studentName")
                Button("Save student") { var next = controller.workspace; next.studentName = name; controller.commit(next) }
                Text("Working records only. Human review controls approval; no automated eligibility or placement.").font(.caption)
            }
            Section("Goals and progress") {
                ForEach(controller.workspace.goals) { goal in
                    NavigationLink { GoalReview(controller: controller, goalID: goal.id) } label: {
                        VStack(alignment: .leading) { Text(goal.reviewedLanguage); Text(goal.approved ? "Human approved" : "Draft — review required").font(.caption); Text(goal.mastery).font(.caption) }
                    }
                }
                if controller.workspace.goals.isEmpty { Text("Import a source, then review a source-linked draft.") }
            }
            Section("Report") {
                Button("Prepare reviewed report") { report = controller.workspace.report() }
                if !report.isEmpty { Text(report).textSelection(.enabled); Text("Report is shown in memory. Use encrypted recovery export for a local file; no plaintext report is written automatically.").font(.caption) }
            }
        }.navigationTitle("Workspace").onAppear { name = controller.workspace.studentName }
    }
}
struct GoalReview: View {
    @Bindable var controller: WorkspaceController
    let goalID: UUID
    @State private var language = ""
    @State private var target = 80
    @State private var criteriaConfirmed = false
    @State private var correct = "8"
    @State private var total = "10"
    @State private var evidence = ""
    @State private var prompted = true
    var goal: Goal? { controller.workspace.goals.first {$0.id == goalID} }
    var body: some View {
        if let goal {
            Form {
                Section("Verbatim evidence") { Text(goal.sourceQuote); Text("Source \(goal.sourceID) · line \(goal.lineID)").font(.caption) }
                Section("Human review") {
                    TextEditor(text: $language).frame(minHeight: 100).accessibilityLabel("Reviewed goal")
                    Stepper("Target: \(target)%", value: $target, in: 1...100)
                    Text("Criterion: 4 of 5 independent trials. Confirm these values against the source before approving.")
                    Toggle("I verified the criterion against the source", isOn: $criteriaConfirmed).accessibilityIdentifier("criteriaConfirmed")
                    Button("Approve reviewed goal") { change { $0.reviewedLanguage = language; $0.targetPercent = target; $0.approved = true; $0.approvedAt = Date() } }.disabled(!criteriaConfirmed).accessibilityIdentifier("approveGoal")
                }
                Section("Progress evidence") {
                    Text(goal.mastery).accessibilityIdentifier("mastery")
                    TextField("Correct", text: $correct).keyboardType(.numberPad)
                    TextField("Total", text: $total).keyboardType(.numberPad)
                    TextField("Unique trial / evidence identifier", text: $evidence).accessibilityIdentifier("evidenceID")
                    Toggle("Verbal or other prompt used", isOn: $prompted)
                    Button("Save observation") {
                        guard let c = Int(correct), let t = Int(total), c >= 0, t > 0, c <= t, !evidence.trimmingCharacters(in: .whitespaces).isEmpty, !goal.observations.contains(where: {$0.evidenceID == evidence}) else { controller.message = "Invalid or duplicate trial evidence. Nothing saved."; return }
                        change { $0.observations.append(TrialObservation(correct: c, total: t, note: "Human-entered trial", evidenceID: evidence, prompted: prompted)) }
                    }.disabled(!goal.approved).accessibilityIdentifier("saveObservation")
                    ForEach(goal.observations) { observation in Text("\(observation.correct)/\(observation.total) · \(observation.prompted ? "prompted" : "independent") · \(observation.evidenceID)") }
                }
            }.navigationTitle("Goal review").onAppear { language = goal.reviewedLanguage; target = goal.targetPercent }
        }
    }
    private func change(_ edit: (inout Goal) -> Void) {
        var next = controller.workspace
        if let i = next.goals.firstIndex(where: {$0.id == goalID}) { edit(&next.goals[i]); controller.commit(next) }
    }
}
struct RecoveryView: View {
    @Bindable var controller: WorkspaceController
    @State private var password = ""
    @State private var exporting = false
    @State private var importing = false
    @State private var archive = EncryptedDocument(data: Data())
    @State private var pendingRestore: Data?
    @State private var restoreConfirmation = false
    @State private var localCopy: URL?
    var body: some View {
        Form {
            Section("Encrypted local recovery") {
                SecureField("Recovery password (12+ characters)", text: $password).textContentType(.newPassword)
                Text("Keep this password separately. The backup includes encrypted original documents, OCR, goals and progress. It does not include the device key.")
                Button("Export encrypted backup") {
                    do { archive = EncryptedDocument(data: try controller.vault.backup(controller.workspace, password: password)); exporting = true }
                    catch { controller.message = error.localizedDescription }
                }
                Button("Create local encrypted recovery copy") {
                    do {
                        let data = try controller.vault.backup(controller.workspace, password: password)
                        let directory = controller.vault.url.deletingLastPathComponent().appendingPathComponent("Recovery", isDirectory: true)
                        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                        var protectedDirectory = directory
                        var values = URLResourceValues(); values.isExcludedFromBackup = true
                        try protectedDirectory.setResourceValues(values)
                        let url = directory.appendingPathComponent(UUID().uuidString + ".iepbackup")
                        try data.write(to: url, options: [.atomic, .completeFileProtection])
                        localCopy = url; controller.message = "Encrypted recovery copy saved locally"
                    } catch { controller.message = "Recovery copy failed; workspace unchanged." }
                }.accessibilityIdentifier("localBackup")
                if let localCopy {
                    Button("Restore this local copy") { pendingRestore = try? Data(contentsOf: localCopy); restoreConfirmation = pendingRestore != nil }.accessibilityIdentifier("restoreLocal")
                    Text("This copy remains in the app sandbox. Export it to a separate local destination for recovery after app removal.").font(.caption)
                }
                Button("Choose encrypted backup") { importing = true }
                Text("Choose an On My iPhone/iPad destination. No remote backup is configured. Restoring replaces this working workspace only after authentication and validation.").font(.caption)
            }
        }.navigationTitle("Recovery")
        .fileExporter(isPresented: $exporting, document: archive, contentType: .data, defaultFilename: "IEP-local-backup.iepbackup") { result in
            controller.message = (try? result.get()) != nil ? "Encrypted backup exported" : "Export cancelled or failed"
            archive = EncryptedDocument(data: Data())
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.data]) { result in
            if case .success(let url) = result {
                let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
                pendingRestore = try? Data(contentsOf: url)
                restoreConfirmation = pendingRestore != nil
            }
        }
        .confirmationDialog("Replace workspace with authenticated backup?", isPresented: $restoreConfirmation) {
            Button("Cancel", role: .cancel) { pendingRestore = nil }
            Button("Restore local backup", role: .destructive) { if let data = pendingRestore { controller.restore(data, password: password) }; pendingRestore = nil }
        }
    }
}
