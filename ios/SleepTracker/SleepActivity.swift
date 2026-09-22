import Foundation
import WidgetKit

@objc(SleepActivity)
class SleepActivity: NSObject {
  private let suiteName = "group.com.anonymous.SleepTracker"
  private let startKey = "sleepStart"
  private let pendingSessionKey = "pendingSleepSession"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(start:rejecter:)
  func start(resolve: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
    let now = Date()
    defaults.set(now.timeIntervalSince1970, forKey: startKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolve(["start": iso8601.string(from: now)])
  }

  @objc(stop:rejecter:)
  func stop(resolve: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
    guard let start = storedStartDate else {
      resolve(nil)
      return
    }

    let session = completeSleep(start: start)
    WidgetCenter.shared.reloadAllTimelines()
    resolve(session)
  }

  @objc(current:rejecter:)
  func current(resolve: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
    guard let start = storedStartDate else {
      resolve(nil)
      return
    }
    resolve(["start": iso8601.string(from: start)])
  }

  @objc(takeCompletedSession:rejecter:)
  func takeCompletedSession(resolve: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
    let session = defaults.dictionary(forKey: pendingSessionKey)
    defaults.removeObject(forKey: pendingSessionKey)
    resolve(session)
  }

  private var defaults: UserDefaults {
    UserDefaults(suiteName: suiteName) ?? .standard
  }

  private var iso8601: ISO8601DateFormatter {
    ISO8601DateFormatter()
  }

  private var storedStartDate: Date? {
    guard defaults.object(forKey: startKey) != nil else {
      return nil
    }
    return Date(timeIntervalSince1970: defaults.double(forKey: startKey))
  }

  private func completeSleep(start: Date) -> [String: Any] {
    let end = Date()
    let duration = (end.timeIntervalSince(start) / 3600 * 100).rounded() / 100
    let session: [String: Any] = [
      "start": iso8601.string(from: start),
      "end": iso8601.string(from: end),
      "duration": duration,
    ]
    defaults.removeObject(forKey: startKey)
    return session
  }
}
