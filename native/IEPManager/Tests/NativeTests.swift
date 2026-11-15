import XCTest
import CryptoKit
import Security
import UIKit
@testable import IEPManager

final class TestKeys: VaultKeys {
    var value: SymmetricKey? = SymmetricKey(size: .bits256)
    var creates = 0
    func key(create: Bool) throws -> SymmetricKey {
        if create { creates += 1 }
        guard let value else { throw NativeError.locked }; return value
    }
}
final class NativeTests: XCTestCase {
    func vault(_ keys: TestKeys = TestKeys()) throws -> Vault {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        addTeardownBlock { try? FileManager.default.removeItem(at: dir) }
        return Vault(url: dir.appendingPathComponent("vault"), keys: keys)
    }
    func workspace() throws -> NativeWorkspace {
        let source = try LocalOCR.recognize(LocalOCR.syntheticWorksheet(), name: "CANARY-SYNTHETIC.png")
        var w = NativeWorkspace(); w.studentName = "CANARY-SYNTHETIC-STUDENT"; w.sources = [source]
        let line = try XCTUnwrap(source.lines.first(where: {$0.text.contains("Goal:")}))
        var goal = try LocalModel.groundedGoal(quote: line.text, source: source)
        goal.approved = true; goal.approvedAt = Date()
        w.goals = [goal]; return w
    }
    func testRealVisionOCRAndOriginalPreservation() throws {
        let w = try workspace()
        XCTAssertTrue(w.sources[0].text.contains("8 of 10"))
        XCTAssertTrue(w.sources[0].text.contains("4 of 5"))
        XCTAssertTrue(w.sources[0].method.contains("Vision"))
        XCTAssertTrue(w.sources[0].sha256 == digest(w.sources[0].original))
    }
    func testBlankWrongInputAndUngroundedModelRejected() throws {
        XCTAssertThrowsError(try LocalOCR.recognize(Data("not an image".utf8), name: "wrong.png"))
        let image = UIGraphicsImageRenderer(size: CGSize(width: 200, height: 200)).pngData { ctx in UIColor.white.setFill();ctx.fill(CGRect(x:0,y:0,width:200,height:200)) }
        XCTAssertThrowsError(try LocalOCR.recognize(image,name:"blank.png"))
        let w = try workspace()
        XCTAssertThrowsError(try LocalModel.groundedGoal(quote:"invented unrelated source goal",source:w.sources[0]))
    }
    func testEncryptionCanariesTamperWrongKeyAndContext() throws {
        let key = TestKeys(); let v = try vault(key); let w = try workspace(); try v.save(w)
        let bytes = try Data(contentsOf:v.url)
        XCTAssertFalse(String(decoding:bytes,as:UTF8.self).contains("CANARY"))
        XCTAssertFalse(String(decoding:bytes,as:UTF8.self).contains("Goal:"))
        XCTAssertFalse(bytes.range(of:w.sources[0].original) != nil)
        XCTAssertTrue(try v.load().sources[0].original == w.sources[0].original)
        var other=v; other.identity="different-vault"; XCTAssertThrowsError(try other.load())
        key.value=SymmetricKey(size:.bits256); XCTAssertThrowsError(try v.load())
        var corrupt=bytes; corrupt[corrupt.count/2] ^= 1; try corrupt.write(to:v.url)
        XCTAssertThrowsError(try v.load()); XCTAssertTrue(try Data(contentsOf:v.url)==corrupt)
    }
    func testMissingInaccessibleKeyNeverRegeneratesOrChangesVault() throws {
        let key=TestKeys();let v=try vault(key);try v.save(workspace());let original=try Data(contentsOf:v.url)
        key.value=nil;key.creates=0
        XCTAssertThrowsError(try v.load());XCTAssertThrowsError(try v.save(NativeWorkspace()))
        XCTAssertEqual(key.creates,0);XCTAssertTrue(try Data(contentsOf:v.url)==original)
    }
    func testActualKeychainRoundTripAndMissingAccountFailClosed() throws {
        let account="test-"+UUID().uuidString
        defer { SecItemDelete([kSecClass:kSecClassGenericPassword,kSecAttrService:"local.iepmanager.vault",kSecAttrAccount:account] as CFDictionary) }
        let tmp=try vault();let v=Vault(url:tmp.url,keys:DeviceKey(account:account))
        try v.save(workspace());XCTAssertFalse(try v.load().sources.isEmpty)
        let missing=Vault(url:v.url,keys:DeviceKey(account:account+"-missing"))
        let before=try Data(contentsOf:v.url);XCTAssertThrowsError(try missing.load());XCTAssertTrue(try Data(contentsOf:v.url)==before)
    }
    func testRecoveryWrongPasswordCorruptionFreshDeviceAndFailedWrite() throws {
        let original=try vault();let w=try workspace();try original.save(w)
        let backup=try original.backup(w,password:"synthetic-recovery-secret")
        let fresh=try vault();try fresh.save(NativeWorkspace());let before=try Data(contentsOf:fresh.url)
        XCTAssertThrowsError(try fresh.restore(backup,password:"wrong-password"));XCTAssertTrue(try Data(contentsOf:fresh.url)==before)
        var bad=backup;bad[bad.count/2] ^= 1
        XCTAssertThrowsError(try fresh.restore(bad,password:"synthetic-recovery-secret"));XCTAssertTrue(try Data(contentsOf:fresh.url)==before)
        var failing=fresh;failing.write={_,_ in throw NativeError.locked}
        XCTAssertThrowsError(try failing.restore(backup,password:"synthetic-recovery-secret"));XCTAssertTrue(try Data(contentsOf:fresh.url)==before)
        let restored=try fresh.restore(backup,password:"synthetic-recovery-secret")
        XCTAssertTrue(restored.sources[0].original==w.sources[0].original)
        XCTAssertTrue(try fresh.load().studentName==w.studentName)
        XCTAssertFalse(String(decoding:backup,as:UTF8.self).contains("CANARY"))
    }
    func testObservationNeverMeansRepeatedIndependentMasteryAndDuplicatesRejected() throws {
        var w=try workspace()
        w.goals[0].observations=[TrialObservation(correct:8,total:10,note:"verbal prompt",evidenceID:"trial-1",prompted:true)]
        XCTAssertTrue(w.goals[0].mastery.contains("Insufficient"))
        for i in 2...5 { w.goals[0].observations.append(TrialObservation(correct:4,total:5,note:"verbal prompt",evidenceID:"trial-\(i)",prompted:true)) }
        XCTAssertTrue(w.goals[0].mastery.contains("not yet met"))
        w.goals[0].observations.append(w.goals[0].observations[0]);XCTAssertThrowsError(try w.validated())
        w.goals[0].observations.removeLast();w.sources.append(w.sources[0]);XCTAssertThrowsError(try w.validated())
    }
    func testReportValuesAndAuthenticatedArchiveValidation() throws {
        var w=try workspace();w.goals[0].observations=[TrialObservation(correct:8,total:10,note:"one trial",evidenceID:"trial-1",prompted:false)]
        XCTAssertTrue(w.report().contains("8/10"));XCTAssertTrue(w.report().contains("Insufficient"));XCTAssertTrue(w.report().contains("4 of 5"))
        let v=try vault();w.goals[0].sourceQuote="unrelated";XCTAssertThrowsError(try v.backup(w,password:"synthetic-recovery-secret"))
    }
    func testAuthenticatedInvalidBackupPreservesVault() throws {
        let v=try vault();let w=try workspace();try v.save(w);let before=try Data(contentsOf:v.url)
        var invalid=w;invalid.goals[0].sourceQuote="not source evidence"
        let salt=Data(repeating:7,count:32)
        let key=try Vault.derive("synthetic-recovery-secret",salt:salt,rounds:600_000)
        let ciphertext=try AES.GCM.seal(JSONEncoder().encode(invalid),using:key,authenticating:Vault.backupContext(salt)).combined!
        let archive=try JSONEncoder().encode(BackupEnvelope(version:1,rounds:600_000,salt:salt,ciphertext:ciphertext))
        XCTAssertThrowsError(try v.restore(archive,password:"synthetic-recovery-secret"))
        XCTAssertTrue(try Data(contentsOf:v.url)==before)
    }
    func testImageOnlyPDFUsesRealVision() throws {
        let image=try XCTUnwrap(UIImage(data:LocalOCR.syntheticWorksheet()))
        let pdf=UIGraphicsPDFRenderer(bounds:CGRect(x:0,y:0,width:700,height:450)).pdfData { ctx in
            ctx.beginPage();image.draw(in:CGRect(x:0,y:0,width:700,height:450))
        }
        let source=try LocalOCR.recognize(pdf,name:"synthetic-scan.pdf")
        XCTAssertTrue(source.text.contains("80%"));XCTAssertTrue(source.text.contains("4 of 5"))
        XCTAssertTrue(source.original==pdf);XCTAssertTrue(source.lines.allSatisfy {$0.page==1})
    }
    func testModelCriteriaValidationAbstainsWhenMissing() throws {
        let w=try workspace();let source=w.sources[0]
        let line=try XCTUnwrap(source.lines.first(where: {$0.text.contains("Goal:")}))
        let proposal=try LocalModel.validatedModelGoal(quote:line.text,source:source)
        XCTAssertEqual(proposal.targetPercent,80);XCTAssertFalse(proposal.approved)
        XCTAssertThrowsError(try LocalModel.validatedModelGoal(quote:source.lines[0].text,source:source))
    }
    @MainActor func testLocalFileImportAndDuplicateBytes() async throws {
        let v=try vault();let controller=WorkspaceController(vault:v)
        let directory=v.url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        let file=directory.appendingPathComponent("synthetic-import.txt")
        let bytes=Data("CANARY-FILE-METADATA\nGoal: Read words with 80% accuracy in 4 of 5 trials.".utf8)
        try bytes.write(to:file)
        await controller.importURL(file);await controller.importURL(file)
        XCTAssertEqual(controller.workspace.sources.count,1)
        XCTAssertTrue(controller.workspace.sources[0].original==bytes)
        XCTAssertTrue(controller.message.contains("Duplicate"))
        try FileManager.default.removeItem(at:file)
        let files=try FileManager.default.contentsOfDirectory(at:directory,includingPropertiesForKeys:nil)
        for item in files { XCTAssertFalse(String(decoding:try Data(contentsOf:item),as:UTF8.self).contains("CANARY")) }
    }
    func testRealModelOnlyWhenRuntimeAvailable() async throws {
        guard LocalModel.status == "Apple on-device model available" else { throw XCTSkip(LocalModel.status) }
        let w=try workspace()
        for _ in 0..<3 {
            do {
                let draft=try await LocalModel.propose(w.sources[0])
                XCTAssertFalse(draft.approved);XCTAssertTrue(w.sources[0].text.contains(draft.sourceQuote))
            } catch {
                #if targetEnvironment(simulator)
                throw XCTSkip("Simulator reported model available but real generation failed; host/physical results are separate")
                #else
                throw error
                #endif
            }
        }
    }
}
