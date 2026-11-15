import Foundation
import UIKit
import Vision
import PDFKit

struct LocalOCR {
    static func recognize(_ data: Data, name: String) throws -> SourceRecord {
        guard data.count <= 20_000_000 else { throw NativeError.tooLarge }
        var lines: [SourceLine] = []
        var method = "Vision accurate OCR — local"
        if name.lowercased().hasSuffix(".txt") {
            guard let text = String(data: data, encoding: .utf8) else { throw NativeError.unsupported }
            lines = text.split(separator: "\n").map { SourceLine(page: 1, text: String($0), confidence: 1) }
            method = "UTF-8 text — not OCR"
        } else if name.lowercased().hasSuffix(".pdf") {
            guard let pdf = PDFDocument(data: data) else { throw NativeError.unsupported }
            guard pdf.pageCount <= 30 else { throw NativeError.tooLarge }
            for index in 0..<pdf.pageCount {
                guard let page = pdf.page(at: index) else { continue }
                let image = page.thumbnail(of: CGSize(width: 1700, height: 2200), for: .mediaBox)
                guard let cg = image.cgImage else { continue }
                lines += try imageLines(cg, page: index + 1)
            }
        } else {
            guard let image = UIImage(data: data) else { throw NativeError.unsupported }
            guard image.size.width * image.size.height <= 20_000_000 else { throw NativeError.tooLarge }
            let normalized = UIGraphicsImageRenderer(size: image.size).image { _ in image.draw(at: .zero) }
            guard let cg = normalized.cgImage else { throw NativeError.unsupported }
            lines = try imageLines(cg, page: 1)
        }
        guard !lines.isEmpty else { throw NativeError.noText }
        return SourceRecord(name: name, original: data, sha256: digest(data), lines: lines, reviewedText: lines.map(\.text).joined(separator: "\n"), method: method)
    }
    private static func imageLines(_ image: CGImage, page: Int) throws -> [SourceLine] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["en-US"]
        request.usesLanguageCorrection = false
        try VNImageRequestHandler(cgImage: image).perform([request])
        return (request.results ?? []).compactMap { observation in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            return SourceLine(page: page, text: candidate.string, confidence: candidate.confidence)
        }
    }
    static func syntheticWorksheet() -> Data {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 1400, height: 900))
        return renderer.pngData { context in
            UIColor.white.setFill(); context.fill(CGRect(x: 0, y: 0, width: 1400, height: 900))
            let lines = ["SYNTHETIC WORKSHEET — NOT A STUDENT RECORD", "Student: Synthetic Cedar", "Goal: Read words with 80% accuracy in 4 of 5 trials.", "TrialObservation: 8 of 10 correct. One trial only.", "A single observation does not establish mastery."]
            for (index, line) in lines.enumerated() {
                (line as NSString).draw(at: CGPoint(x: 55, y: 70 + index * 120), withAttributes: [.font: UIFont.systemFont(ofSize: 35), .foregroundColor: UIColor.black])
            }
        }
    }
}
