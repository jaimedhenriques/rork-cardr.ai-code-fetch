import SwiftUI
import UIKit

/// A month calendar that plots the user's events and lists the ones falling on
/// the selected day — mirroring the web `Calendar` page, wired to live events.
struct CalendarView: View {
    @Environment(DataStore.self) private var data

    @State private var currentMonth: Date = Calendar.current.startOfDay(for: Date())
    @State private var selectedDate: Date = Calendar.current.startOfDay(for: Date())

    private let calendar = Calendar.current
    private let weekdaySymbols = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                monthCard
                selectedDayHeader
                selectedDayEvents
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Calendar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Today") { goToToday() }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.primary)
            }
        }
        .navigationDestination(for: Event.self) { EventDetailView(event: $0) }
        .task { if data.events.isEmpty { await data.loadEvents() } }
    }

    // MARK: - Month grid

    private var monthCard: some View {
        CardSurface {
            VStack(spacing: 14) {
                monthHeader
                weekdayRow
                grid
            }
        }
    }

    private var monthHeader: some View {
        HStack {
            Text(monthTitle)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.ink)
                .contentTransition(.numericText())
            Spacer()
            HStack(spacing: 6) {
                navButton("chevron.left") { step(by: -1) }
                navButton("chevron.right") { step(by: 1) }
            }
        }
    }

    private func navButton(_ systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        }) {
            Image(systemName: systemName)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.ink)
                .frame(width: 32, height: 32)
                .background(Theme.surfaceMuted)
                .clipShape(Circle())
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var weekdayRow: some View {
        HStack(spacing: 4) {
            ForEach(weekdaySymbols, id: \.self) { symbol in
                Text(symbol)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var grid: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
        return LazyVGrid(columns: columns, spacing: 4) {
            ForEach(monthDays, id: \.self) { day in
                dayCell(day)
            }
        }
    }

    private func dayCell(_ day: Date) -> some View {
        let inMonth = calendar.isDate(day, equalTo: currentMonth, toGranularity: .month)
        let isToday = calendar.isDateInToday(day)
        let isSelected = calendar.isDate(day, inSameDayAs: selectedDate)
        let count = events(on: day).count

        return Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            withAnimation(.snappy(duration: 0.18)) { selectedDate = day }
        } label: {
            VStack(spacing: 3) {
                Text("\(calendar.component(.day, from: day))")
                    .font(.system(size: 14, weight: isSelected ? .bold : .medium))
                Circle()
                    .fill(count > 0 ? (isSelected ? Color.white : Theme.primary) : .clear)
                    .frame(width: 5, height: 5)
            }
            .foregroundStyle(cellTextColor(inMonth: inMonth, isToday: isToday, isSelected: isSelected))
            .frame(maxWidth: .infinity)
            .aspectRatio(1, contentMode: .fit)
            .background(cellBackground(isToday: isToday, isSelected: isSelected))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(isToday && !isSelected ? Theme.primary.opacity(0.4) : .clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func cellTextColor(inMonth: Bool, isToday: Bool, isSelected: Bool) -> Color {
        if isSelected { return .white }
        if !inMonth { return Theme.inkSecondary.opacity(0.3) }
        if isToday { return Theme.primary }
        return Theme.ink
    }

    @ViewBuilder
    private func cellBackground(isToday: Bool, isSelected: Bool) -> some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(isSelected ? AnyShapeStyle(Theme.brandGradient)
                  : isToday ? AnyShapeStyle(Theme.primary.opacity(0.1))
                  : AnyShapeStyle(Color.clear))
    }

    // MARK: - Selected day

    private var selectedDayHeader: some View {
        HStack {
            Text(selectedDayTitle)
                .font(.system(size: 13, weight: .bold))
                .textCase(.uppercase)
                .tracking(1.1)
                .foregroundStyle(Theme.primary)
            Spacer()
            let count = events(on: selectedDate).count
            if count > 0 {
                Text("\(count) event\(count == 1 ? "" : "s")")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .padding(.leading, 4)
    }

    @ViewBuilder
    private var selectedDayEvents: some View {
        let dayEvents = events(on: selectedDate)
        if dayEvents.isEmpty {
            CardSurface {
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .font(.system(size: 26, weight: .light))
                        .foregroundStyle(Theme.inkSecondary.opacity(0.5))
                    Text("No events this day")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text("Pick another day or create an event from the Events screen.")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
        } else {
            VStack(spacing: 10) {
                ForEach(dayEvents) { event in
                    NavigationLink(value: event) {
                        CalendarEventRow(event: event, count: data.contactCount(forEvent: event.id))
                    }
                    .buttonStyle(PressableButtonStyle())
                }
            }
        }
    }

    // MARK: - Date helpers

    private var monthTitle: String {
        let df = DateFormatter()
        df.dateFormat = "MMMM yyyy"
        return df.string(from: currentMonth)
    }

    private var selectedDayTitle: String {
        if calendar.isDateInToday(selectedDate) { return "Today" }
        let df = DateFormatter()
        df.dateFormat = "EEEE, MMM d"
        return df.string(from: selectedDate)
    }

    /// 42 days (6 weeks) starting from the Sunday on/before the first of month.
    private var monthDays: [Date] {
        guard let monthInterval = calendar.dateInterval(of: .month, for: currentMonth) else { return [] }
        let firstWeekday = calendar.component(.weekday, from: monthInterval.start) - 1
        guard let gridStart = calendar.date(byAdding: .day, value: -firstWeekday, to: monthInterval.start) else { return [] }
        return (0..<42).compactMap { calendar.date(byAdding: .day, value: $0, to: gridStart) }
    }

    /// Events overlapping the given day (handles multi-day ranges).
    private func events(on day: Date) -> [Event] {
        let target = calendar.startOfDay(for: day)
        return data.events.filter { event in
            guard let start = event.startsAt else { return false }
            let startDay = calendar.startOfDay(for: start)
            let endDay = calendar.startOfDay(for: event.endsAt ?? start)
            return target >= startDay && target <= endDay
        }
    }

    private func step(by months: Int) {
        guard let next = calendar.date(byAdding: .month, value: months, to: currentMonth) else { return }
        withAnimation(.snappy(duration: 0.2)) { currentMonth = next }
    }

    private func goToToday() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        let today = calendar.startOfDay(for: Date())
        withAnimation(.snappy(duration: 0.2)) {
            currentMonth = today
            selectedDate = today
        }
    }
}

/// A compact event row shown under the calendar for the selected day.
private struct CalendarEventRow: View {
    let event: Event
    let count: Int

    var body: some View {
        CardSurface(padding: 14) {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .fill(Theme.primary.opacity(0.12))
                    .frame(width: 42, height: 42)
                    .overlay {
                        Image(systemName: "calendar")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Theme.primary)
                    }
                VStack(alignment: .leading, spacing: 3) {
                    Text(event.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    HStack(spacing: 10) {
                        if let location = event.location, !location.isEmpty {
                            Label(location, systemImage: "mappin.and.ellipse")
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.inkSecondary)
                                .lineLimit(1)
                        }
                        if count > 0 {
                            Label("\(count)", systemImage: "person.2.fill")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Theme.primary)
                        }
                    }
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            }
        }
    }
}
