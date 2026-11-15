import Foundation
import CryptoKit

struct SourceLine: Codable, Identifiable, Equatable {
    var id = UUID()
    var page: Int
    var text: String
    var confidence: Float
}
struct SourceRecord: Codable, Identifiable {
    var id = UUID()
    var name: String
    var original: Data
    var sha256: String
    var lines: [SourceLine]
    var reviewedText: String
    var method: String
    var text: String { lines.map(\.text).joined(separator: "\n") }
}
struct Goal: Codable, Identifiable {
    var id = UUID()
    var sourceID: UUID
    var lineID: UUID
    var sourceQuote: String
    var reviewedLanguage: String
    var approved = false
    var approvedAt: Date?
    var targetPercent = 80
    var requiredSuccesses = 4
    var trialWindow = 5
    var observations: [TrialObservation] = []
    var mastery: String {
        guard approved else { return "Draft — no mastery determination" }
        guard observations.count >= trialWindow else { return "Insufficient evidence: \(observations.count)/\(trialWindow) trials" }
        let passed = observations.suffix(trialWindow).filter { !$0.prompted && $0.correct * 100 >= targetPercent * $0.total }.count
        return passed >= requiredSuccesses ? "Criterion met in \(passed)/\(trialWindow) trials — human review required" : "Criterion not yet met: \(passed)/\(trialWindow) qualifying trials"
    }
}
struct TrialObservation: Codable, Identifiable {
    var id = UUID()
    var date = Date()
    var correct: Int
    var total: Int
    var note: String
    var evidenceID: String
    var prompted: Bool
}
struct NativeWorkspace: Codable {
    var version = 1
    var studentName = "Synthetic Cedar"
    var sources: [SourceRecord] = []
    var goals: [Goal] = []
    func validated() throws -> Self {
        guard version == 1, !studentName.isEmpty, sources.count <= 100, goals.count <= 500, sources.reduce(0, { $0 + $1.original.count }) <= 50_000_000 else { throw NativeError.invalidRecord }
        guard Set(sources.map(\.sha256)).count == sources.count else { throw NativeError.invalidRecord }
        for source in sources {
            guard source.original.count <= 20_000_000, source.sha256 == digest(source.original), source.lines.count <= 10000 else { throw NativeError.invalidRecord }
        }
        for goal in goals {
            guard let source = sources.first(where: {$0.id == goal.sourceID}),
                  let line = source.lines.first(where: {$0.id == goal.lineID}),
                  !goal.sourceQuote.isEmpty, line.text.contains(goal.sourceQuote),
                  (1...100).contains(goal.targetPercent), goal.trialWindow == 5, goal.requiredSuccesses == 4,
                  !goal.reviewedLanguage.isEmpty,
                  Set(goal.observations.map { $0.evidenceID.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }).count == goal.observations.count,
                  goal.observations.allSatisfy({ !$0.evidenceID.isEmpty }),
                  goal.observations.allSatisfy({ $0.total > 0 && $0.total <= 10000 && $0.correct >= 0 && $0.correct <= $0.total }) else { throw NativeError.invalidRecord }
        }
        return self
    }
    func report() -> String {
        (["IEP Manager — human-reviewed working record", "Student: \(studentName)", "Not an eligibility or placement decision."] + goals.filter(\.approved).flatMap { goal in
            ["Goal: \(goal.reviewedLanguage)", "Criterion: \(goal.targetPercent)% in \(goal.requiredSuccesses) of \(goal.trialWindow) trials", "Source: \(goal.sourceID) / \(goal.lineID)", "Verbatim evidence: \(goal.sourceQuote)", goal.mastery] + goal.observations.map { "Observation: \($0.correct)/\($0.total) — \($0.prompted ? "prompted" : "independent") — \($0.note)" }
        }).joined(separator: "\n\n")
    }
}
func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
enum NativeError: LocalizedError {
    case locked, invalidRecord, unsupported, noText, noModel(String), ungrounded, password, tooLarge, camera(String)
    var errorDescription: String? {
        switch self {
        case .locked: "Vault locked: key missing, unavailable, or data failed authentication. No key was replaced."
        case .invalidRecord: "Record validation failed. Existing data was preserved."
        case .unsupported: "Unsupported file. Choose a local PDF, PNG, JPEG, or UTF-8 TXT."
        case .noText: "No readable text found. Try a clearer scan; no extracted record was created."
        case .noModel(let reason): "No model available: \(reason). Manual source review remains available."
        case .ungrounded: "Model abstained or returned ungrounded text. No goal was created."
        case .password: "Backup password must contain at least 12 characters."
        case .tooLarge: "Document exceeds the 20 MB / 30-page local processing limit."
        case .camera(let reason): reason
        }
    }
}
