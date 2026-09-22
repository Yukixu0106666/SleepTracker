import AppIntents
import SwiftUI
import WidgetKit

private enum SleepStore {
  static let suiteName = "group.com.anonymous.SleepTracker"
  static let startKey = "sleepStart"
  static let pendingSessionKey = "pendingSleepSession"

  static var startDate: Date? {
    guard let defaults = UserDefaults(suiteName: suiteName), defaults.object(forKey: startKey) != nil else {
      return nil
    }
    return Date(timeIntervalSince1970: defaults.double(forKey: startKey))
  }

  static var needsSleepTimingReminder: Bool {
    let hour = Calendar.current.component(.hour, from: .now)
    let isMiddayRestWindow = hour >= 12 && hour < 14
    return hour < 21 && !isMiddayRestWindow
  }

  static func start() {
    UserDefaults(suiteName: suiteName)?.set(Date().timeIntervalSince1970, forKey: startKey)
    WidgetCenter.shared.reloadAllTimelines()
  }

  static func stop() -> Double? {
    guard let startDate else { return nil }

    let end = Date()
    let duration = (end.timeIntervalSince(startDate) / 3600 * 100).rounded() / 100
    let session: [String: Any] = [
      "start": ISO8601DateFormatter().string(from: startDate),
      "end": ISO8601DateFormatter().string(from: end),
      "duration": duration,
    ]
    let defaults = UserDefaults(suiteName: suiteName)
    defaults?.removeObject(forKey: startKey)
    defaults?.set(session, forKey: pendingSessionKey)
    WidgetCenter.shared.reloadAllTimelines()
    return duration
  }

  static func suggestion(for duration: Double) -> String {
    let hours = String(format: "%.1f", duration)
    let mindset = "You do not need to make up for every minute of sleep today. Aim for a kind, ordinary day, take breaks when needed, and remind yourself that one difficult night does not define tonight."
    if duration < 7 {
      return "Today's Sleep Support: A shorter night is hard, but it is not a failure. First meal: 1 bowl oatmeal with Greek yogurt, a banana, and a small handful of walnuts (1 bowl + 150 g yogurt + 1 banana + 20 g walnuts). Movement: Daylight walk and mobility reset, 25 minutes. Start with Easy walk. Mindset: \(mindset)"
    }
    return "Today's Sleep Support: Your \(hours) hours of rest is a useful foundation for today. First meal: Eggs or tofu on whole-grain toast with berries (2 eggs or 150 g tofu + 2 slices toast + 1 cup berries). Movement: Brisk walk with beginner bodyweight strength, 35 minutes. Start with Easy walk. Mindset: \(mindset)"
  }
}

struct ToggleSleepIntent: AppIntent {
  static var title: LocalizedStringResource = "Toggle sleep tracking"
  static var description = IntentDescription("Start or stop tracking a sleep session.")
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    if SleepStore.startDate == nil {
      if SleepStore.needsSleepTimingReminder {
        if #available(iOS 18.0, *) {
          try await requestConfirmation(
            conditions: [],
            actionName: .continue,
            dialog: IntentDialog("This is outside the usual night sleep window after 9:00 PM and the 12:00-2:00 PM rest window. Do you want to start sleep tracking anyway?")
          )
        } else {
          try await requestConfirmation(result: .result(), confirmationActionName: .continue)
        }
      }
      SleepStore.start()
      return .result(dialog: "Sleep tracking started.")
    }

    if #available(iOS 18.0, *) {
      try await requestConfirmation(
        conditions: [],
        actionName: .continue,
        dialog: IntentDialog("Finish this sleep? We'll save this session and prepare your daily support plan.")
      )
    } else {
      try await requestConfirmation(result: .result(), confirmationActionName: .continue)
    }

    guard let duration = SleepStore.stop() else {
      return .result(dialog: "No active sleep session was found.")
    }
    return .result(dialog: IntentDialog(stringLiteral: SleepStore.suggestion(for: duration)))
  }
}

struct SleepEntry: TimelineEntry {
  let date: Date
  let startDate: Date?
}

struct SleepProvider: TimelineProvider {
  func placeholder(in context: Context) -> SleepEntry {
    SleepEntry(date: .now, startDate: .now)
  }

  func getSnapshot(in context: Context, completion: @escaping (SleepEntry) -> Void) {
    completion(SleepEntry(date: .now, startDate: SleepStore.startDate))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SleepEntry>) -> Void) {
    let entry = SleepEntry(date: .now, startDate: SleepStore.startDate)
    completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(60))))
  }
}

struct SleepControlWidgetView: View {
  let entry: SleepEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    Button(intent: ToggleSleepIntent()) {
      content(startDate: entry.startDate)
    }
    .buttonStyle(.plain)
  }

  @ViewBuilder
  private func content(startDate: Date?) -> some View {
    if family == .accessoryCircular {
      Image(systemName: startDate == nil ? "bed.double.fill" : "moon.stars.fill")
        .font(.title3.weight(.semibold))
        .widgetAccentable()
    } else if family == .accessoryRectangular {
      HStack(spacing: 10) {
        Image(systemName: startDate == nil ? "bed.double.fill" : "moon.stars.fill")
          .font(.title3)
          .widgetAccentable()
        VStack(alignment: .leading, spacing: 2) {
          Text(startDate == nil ? "SleepTracker" : "Sleep in progress")
            .font(.caption.weight(.semibold))
          if let startDate {
            Text(startDate, style: .timer).font(.caption2)
          } else {
            Text("Tap to start").font(.caption2)
          }
        }
      }
    } else {
      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .top, spacing: 4) {
          if startDate == nil {
            VStack(alignment: .leading, spacing: 0) {
              Text("Ready for")
              Text("sleep")
            }
            .font(.system(size: 19, weight: .semibold, design: .rounded))
            .fixedSize()
            .foregroundStyle(.white)
          } else {
            Text("Sleeping")
              .font(.system(size: 19, weight: .semibold, design: .rounded))
              .fixedSize()
              .foregroundStyle(.white)
          }
          Spacer()
          Image(systemName: startDate == nil ? "bed.double.fill" : "moon.stars.fill")
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Self.moonlight)
        }

        Spacer(minLength: 10)

        if let startDate {
          Text(startDate, style: .timer)
            .font(.system(size: 32, weight: .medium, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.white)
        }

        Spacer(minLength: 10)

        Text(startDate == nil ? "START" : "STOP")
          .font(.caption.weight(.bold))
          .tracking(0.6)
          .frame(maxWidth: .infinity)
        .foregroundStyle(startDate == nil ? Self.moonlight : Self.wakeBlue)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(startDate == nil ? Self.startSurface : Self.stopSurface, in: Capsule())
      }
    }
  }

  static let midnight = Color(red: 0.039, green: 0.086, blue: 0.153)
  private static let mistBlue = Color(red: 0.62, green: 0.72, blue: 0.80)
  private static let moonlight = Color(red: 0.90, green: 0.80, blue: 0.50)
  private static let wakeBlue = Color(red: 0.63, green: 0.84, blue: 0.91)
  private static let startSurface = Color(red: 0.12, green: 0.22, blue: 0.33)
  private static let stopSurface = Color(red: 0.12, green: 0.31, blue: 0.38)
}

struct SleepControlWidget: Widget {
  let kind = "SleepControlWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SleepProvider()) { entry in
      SleepControlWidgetView(entry: entry)
        .containerBackground(for: .widget) {
          SleepControlWidgetView.midnight
        }
    }
    .configurationDisplayName("Sleep control")
    .description("Start or stop sleep tracking from your Home Screen or Lock Screen.")
    .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
  }
}

@main
struct SleepControlWidgetBundle: WidgetBundle {
  var body: some Widget {
    SleepControlWidget()
  }
}
