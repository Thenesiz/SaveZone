const STORAGE_KEY = "savezone-v2";
const CATEGORY_COLORS = ["", "color-1", "color-2", "color-3", "color-4"];
const CATEGORY_INITIALS = { "Food & drink": "F", Transport: "T", Groceries: "G", Shopping: "S", Bills: "B", Health: "H", Education: "E", Other: "O" };

function toDateInputValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function loadState() {
  try {
    localStorage.removeItem("savezone-v1");
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.expenses) && Number.isFinite(saved.allowance)) return { allowance: Math.max(0, saved.allowance), expenses: saved.expenses };
  } catch {
    // Fall back to an empty account when storage is unavailable or invalid.
  }
  return { allowance: 0, expenses: [] };
}

let state = loadState();
let activeView = "dashboard";
let searchQuery = "";

const elements = {
  monthSpend: document.querySelector("#month-spend"), remainingAmount: document.querySelector("#remaining-amount"),
  expenseCount: document.querySelector("#expense-count"), budgetCaption: document.querySelector("#budget-caption"),
  budgetProgress: document.querySelector("#budget-progress"), dailyAverage: document.querySelector("#daily-average"),
  monthLabel: document.querySelector("#month-label"), todayLabel: document.querySelector("#today-label"),
  weekSpend: document.querySelector("#week-spend"), weeklyChart: document.querySelector("#weekly-chart"),
  categoryList: document.querySelector("#category-list"), recentTransactions: document.querySelector("#recent-transactions"),
  recentEmpty: document.querySelector("#recent-empty"), allTransactions: document.querySelector("#all-transactions"),
  allExpenseCount: document.querySelector("#all-expense-count"), expensesEmpty: document.querySelector("#expenses-empty"),
  categoryFilter: document.querySelector("#category-filter"), savingsAllowance: document.querySelector("#savings-allowance"),
  savingsExpenses: document.querySelector("#savings-expenses"), savingsNet: document.querySelector("#savings-net"),
  savingsPercent: document.querySelector("#savings-percent"), savingsProgress: document.querySelector("#savings-progress"),
  savingsSpentPercent: document.querySelector("#savings-spent-percent"), savingsLeftPercent: document.querySelector("#savings-left-percent"),
  savingsTrack: document.querySelector(".savings-track"), savingsNote: document.querySelector("#savings-note"),
  search: document.querySelector("#global-search"),
};

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    showToast("Browser storage is unavailable; changes won't persist after closing this tab.");
  }
}

function money(value) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function getMonthExpenses() {
  const now = new Date();
  return state.expenses.filter((expense) => {
    const date = parseLocalDate(expense.date);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
}

function getWeekExpenses() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return state.expenses.filter((expense) => {
    const date = parseLocalDate(expense.date);
    return date >= start && date < end;
  });
}

function formatDate(value) {
  const date = parseLocalDate(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function sortedExpenses(expenses) {
  return [...expenses].sort((first, second) => second.date.localeCompare(first.date));
}

function getFilteredExpenses() {
  const query = searchQuery.trim().toLocaleLowerCase();
  const category = elements.categoryFilter.value;
  return sortedExpenses(state.expenses).filter((expense) => {
    const matchesQuery = !query || `${expense.description} ${expense.category}`.toLocaleLowerCase().includes(query);
    return matchesQuery && (category === "all" || expense.category === category);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function expenseRow(expense, index, removable) {
  const removeButton = removable ? `<td class="action-column"><button class="remove-expense" type="button" data-remove-expense="${escapeHtml(expense.id)}" aria-label="Delete ${escapeHtml(expense.description)}" title="Delete expense">×</button></td>` : "";
  return `<tr><td class="expense-name"><span class="expense-symbol ${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}" aria-hidden="true">${escapeHtml(CATEGORY_INITIALS[expense.category] ?? "O")}</span>${escapeHtml(expense.description)}</td><td><span class="category-pill">${escapeHtml(expense.category)}</span></td><td>${formatDate(expense.date)}</td><td class="transaction-amount">${money(Number(expense.amount))}</td>${removeButton}</tr>`;
}

function renderSummary() {
  const now = new Date();
  const monthExpenses = getMonthExpenses();
  const total = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const remaining = state.allowance - total;
  const spentRatio = state.allowance > 0 ? Math.min(100, total / state.allowance * 100) : (total > 0 ? 100 : 0);
  const spentPercent = state.allowance > 0 ? Math.round(spentRatio) : 0;
  const leftPercent = state.allowance > 0 ? Math.round(Math.max(0, 100 - spentRatio)) : 0;

  elements.monthLabel.textContent = `This ${new Intl.DateTimeFormat("en", { month: "long" }).format(now)}`;
  elements.todayLabel.textContent = `YOUR ${new Intl.DateTimeFormat("en", { month: "long" }).format(now).toLocaleUpperCase()} SO FAR`;
  elements.monthSpend.textContent = money(total);
  elements.remainingAmount.textContent = money(remaining);
  elements.expenseCount.textContent = `${monthExpenses.length} ${monthExpenses.length === 1 ? "expense" : "expenses"}`;
  elements.budgetCaption.textContent = state.allowance > 0 ? `of ${money(state.allowance)} allowance` : "set an allowance to track progress";
  elements.budgetProgress.style.width = `${Math.min(100, spentRatio)}%`;
  elements.dailyAverage.textContent = money(total / Math.max(1, now.getDate()));
  elements.savingsAllowance.textContent = money(state.allowance);
  elements.savingsExpenses.textContent = money(total);
  elements.savingsNet.textContent = money(remaining);
  elements.savingsPercent.textContent = `${leftPercent}%`;
  elements.savingsSpentPercent.textContent = `${spentPercent}%`;
  elements.savingsLeftPercent.textContent = `${leftPercent}%`;
  elements.savingsProgress.style.width = `${leftPercent}%`;
  elements.savingsTrack.setAttribute("aria-valuenow", String(leftPercent));
  if (state.allowance === 0) elements.savingsNote.textContent = "Set a monthly allowance to see how spending compares with your plan.";
  else if (remaining < 0) elements.savingsNote.textContent = `You're ${money(Math.abs(remaining))} over this month's allowance. A small reset is always possible.`;
  else elements.savingsNote.textContent = `You've kept ${money(remaining)} of your allowance so far. Every small step counts.`;
}

function renderWeeklyChart() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekExpenses = getWeekExpenses();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = toDateInputValue(date);
    const total = weekExpenses.filter((expense) => expense.date === key).reduce((sum, expense) => sum + Number(expense.amount), 0);
    return { date, total, isToday: date.toDateString() === today.toDateString() };
  });
  const max = Math.max(1, ...days.map((day) => day.total));
  const total = weekExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  elements.weekSpend.textContent = money(total);
  elements.weeklyChart.setAttribute("aria-label", `Spending over the last seven days. Total ${money(total)}.`);
  if (total === 0) {
    elements.weeklyChart.innerHTML = '<p class="chart-empty">Add expenses to see your weekly spending here.</p>';
    return;
  }
  elements.weeklyChart.innerHTML = days.map((day) => {
    const weekday = new Intl.DateTimeFormat("en", { weekday: "short" }).format(day.date);
    const label = `${weekday}, ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(day.date)}: ${money(day.total)}`;
    const height = day.total ? Math.max(8, day.total / max * 100) : 3;
    return `<div class="chart-day${day.isToday ? " today" : ""}" aria-label="${escapeHtml(label)}"><div class="chart-bar-track"><span class="chart-bar" style="height:${height}%"></span></div><span>${weekday[0]}</span></div>`;
  }).join("");
}

function renderCategories() {
  const totals = getMonthExpenses().reduce((map, expense) => {
    map.set(expense.category, (map.get(expense.category) ?? 0) + Number(expense.amount));
    return map;
  }, new Map());
  const categories = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!categories.length) {
    elements.categoryList.innerHTML = '<p class="category-empty">Nothing to show yet. Add your first expense.</p>';
    return;
  }
  const max = categories[0][1];
  elements.categoryList.innerHTML = categories.map(([category, total], index) => `<div class="category-row"><span class="category-icon ${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}" aria-hidden="true">${escapeHtml(CATEGORY_INITIALS[category] ?? "O")}</span><span class="category-copy"><strong>${escapeHtml(category)}</strong><span class="category-track"><span style="width:${total / max * 100}%"></span></span></span><span class="category-amount">${money(total)}</span></div>`).join("");
}

function renderTransactions() {
  const expenses = getFilteredExpenses();
  const recent = expenses.slice(0, 4);
  elements.recentTransactions.innerHTML = recent.map((expense, index) => expenseRow(expense, index, false)).join("");
  elements.recentEmpty.classList.toggle("hidden", recent.length > 0);
  elements.recentEmpty.textContent = state.expenses.length === 0
    ? "Your recent expenses will show up here after you add one."
    : "No expenses match your search.";
  elements.allTransactions.innerHTML = expenses.map((expense, index) => expenseRow(expense, index, true)).join("");
  elements.allExpenseCount.textContent = `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"}`;
  elements.expensesEmpty.classList.toggle("hidden", expenses.length > 0);
  elements.expensesEmpty.textContent = state.expenses.length === 0
    ? "No expenses yet. Add your first one to get started."
    : "No expenses match these filters.";
}

function renderCategoryFilter() {
  const selected = elements.categoryFilter.value;
  const categories = [...new Set(state.expenses.map((expense) => expense.category))].sort((a, b) => a.localeCompare(b));
  elements.categoryFilter.innerHTML = '<option value="all">All categories</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  elements.categoryFilter.value = categories.includes(selected) ? selected : "all";
}

function render() {
  renderCategoryFilter();
  renderSummary();
  renderWeeklyChart();
  renderCategories();
  renderTransactions();
}

function setView(viewName) {
  activeView = viewName;
  for (const view of document.querySelectorAll(".view")) view.hidden = view.id !== `view-${viewName}`;
  for (const button of document.querySelectorAll(".nav-link")) {
    const selected = button.dataset.view === viewName;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  document.querySelector("#breadcrumb-current").textContent = { dashboard: "Overview", expenses: "Expenses", savings: "Savings" }[viewName];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.querySelector("#toast-region").append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog.open) dialog.showModal();
  dialog.querySelector("input:not([type=date]),select")?.focus();
}

document.addEventListener("click", (event) => {
  const target = event.target;
  const viewButton = target.closest("[data-view]");
  const viewLink = target.closest("[data-view-link]");
  const dialogButton = target.closest("[data-open-dialog]");
  const closeButton = target.closest("[data-close-dialog]");
  const removeButton = target.closest("[data-remove-expense]");
  if (viewButton) setView(viewButton.dataset.view);
  if (viewLink) setView(viewLink.dataset.viewLink);
  if (dialogButton) openDialog(dialogButton.dataset.openDialog);
  if (closeButton) closeButton.closest("dialog").close();
  if (removeButton) {
    state.expenses = state.expenses.filter((expense) => expense.id !== removeButton.dataset.removeExpense);
    saveState();
    render();
    showToast("Expense removed.");
  }
});

document.querySelector("#expense-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  state.expenses.unshift({ id: crypto.randomUUID?.() ?? `expense-${Date.now()}`, description: String(data.get("description")).trim(), amount: Number(data.get("amount")), category: String(data.get("category")), date: String(data.get("date")) });
  saveState();
  render();
  form.reset();
  document.querySelector("#expense-date").value = toDateInputValue(new Date());
  form.closest("dialog").close();
  showToast("Expense added. Nice and easy.");
});

document.querySelector("#allowance-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  state.allowance = Number(new FormData(form).get("allowance"));
  saveState();
  render();
  form.closest("dialog").close();
  showToast("Monthly allowance updated.");
});

elements.search.addEventListener("input", () => {
  searchQuery = elements.search.value;
  renderTransactions();
  if (searchQuery && activeView === "dashboard") setView("expenses");
});
elements.categoryFilter.addEventListener("change", renderTransactions);
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.search.focus();
  }
});
for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
document.querySelector("#expense-date").value = toDateInputValue(new Date());
document.querySelector('#allowance-form input[name="allowance"]').value = String(state.allowance);
document.querySelector(".notification-button").addEventListener("click", () => showToast("You're all caught up. Enjoy the quiet."));
render();