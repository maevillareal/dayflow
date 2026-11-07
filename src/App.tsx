import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ClockProvider, FilterProvider, ToastProvider } from "./app/providers";
import { Sidebar } from "./app/Sidebar";
import { AuthGate, type Account } from "./features/auth/AuthGate";
import { ExtensionProvider } from "./features/focus/extension";
import { FocusProvider, useFocus } from "./features/focus/focus";
import { ReminderNotifier } from "./companions/reminders";
import { Dashboard } from "./features/dashboard/Dashboard";
import { HabitTracker } from "./features/habits/HabitTracker";
import { TodoList } from "./features/todo/TodoList";
import { FocusMode } from "./features/focus/FocusMode";
import { SelfCare } from "./features/selfcare/SelfCare";
import { SkinCare } from "./features/skincare/SkinCare";
import { EatHealthy } from "./features/eat/EatHealthy";
import { Progress } from "./features/progress/Progress";
import { CalendarPage } from "./features/calendar/CalendarPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { cx } from "./lib/util";

function Shell({ account }: { account: Account }) {
  const focus = useFocus();
  // Companion animations pause during an active focus session.
  return (
    <div className={cx("app", focus.active?.phase === "focus" && "reduce")}>
      <Sidebar account={account} />
      <main id="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/habits" element={<HabitTracker />} />
          <Route path="/todo" element={<TodoList />} />
          <Route path="/focus" element={<FocusMode />} />
          <Route path="/selfcare" element={<SelfCare />} />
          <Route path="/skincare" element={<SkinCare />} />
          <Route path="/eat" element={<EatHealthy />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage account={account} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ReminderNotifier />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ClockProvider>
        <AuthGate>
          {(account) => (
            <ExtensionProvider>
              <FocusProvider>
                <FilterProvider>
                  <HashRouter>
                    <Shell account={account} />
                  </HashRouter>
                </FilterProvider>
              </FocusProvider>
            </ExtensionProvider>
          )}
        </AuthGate>
      </ClockProvider>
    </ToastProvider>
  );
}
