import Foundation
import Vision
import AppKit

struct Line {
  let x: Double
  let y: Double
  let text: String
}

func loadCGImage(from path: String) -> CGImage? {
  guard let nsImage = NSImage(contentsOfFile: path) else { return nil }
  var rect = NSRect(origin: .zero, size: nsImage.size)
  return nsImage.cgImage(forProposedRect: &rect, context: nil, hints: nil)
}

let args = CommandLine.arguments
guard args.count >= 2 else {
  fputs("Usage: vision_ocr.swift <imagePath>\n", stderr)
  exit(2)
}

let path = args[1]
guard let cgImage = loadCGImage(from: path) else {
  fputs("Failed to load image: \(path)\n", stderr)
  exit(1)
}

var lines: [Line] = []

let request = VNRecognizeTextRequest { request, error in
  if let error {
    fputs("OCR error: \(error)\n", stderr)
    return
  }
  guard let results = request.results as? [VNRecognizedTextObservation] else { return }
  for obs in results {
    guard let candidate = obs.topCandidates(1).first else { continue }
    let bb = obs.boundingBox
    lines.append(Line(x: Double(bb.origin.x), y: Double(bb.origin.y), text: candidate.string))
  }
}

request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["ja-JP", "en-US"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try handler.perform([request])

lines.sort {
  if abs($0.y - $1.y) > 0.01 { return $0.y > $1.y } // top to bottom
  return $0.x < $1.x // left to right
}

for l in lines {
  print(String(format: "%.3f\t%.3f\t%@", l.x, l.y, l.text))
}
