chrome.storage.local.get("status").then(({ status }) => {
  const el = document.getElementById("status");
  if (status?.active) {
    const until = status.until ? new Date(status.until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
    el.textContent = `Blocking is on${status.mode === "scheduled" ? " (schedule)" : ""}${until ? ` until ${until}` : ""}.`;
    el.className = "pink";
  } else {
    el.textContent = "Not blocking right now. Start a focus session in DAYFLOW.";
  }
});
