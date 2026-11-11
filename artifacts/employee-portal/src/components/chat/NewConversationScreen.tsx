// Start-a-conversation screen: employee search and picker.
import { Loader2, Search, ArrowLeft, ArrowRight, X } from "lucide-react";
import type { TabChatState } from "./useTabChat";

export function renderNewConversationScreen(chat: TabChatState) {
  const {
    myEmployeeId,
    isRtl,
    isDark,
    effectiveMyId,
    sending,
    setShowNewConv,
    search,
    setSearch,
    employees,
    setEmployees,
    searching,
    onlineEmployees,
    searchEmployees,
    startConversation,
  } = chat;

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const availableEmployees = employees.filter(
    (e) => e.id !== (effectiveMyId ?? myEmployeeId),
  );

  return (
    <div
      className="flex flex-col h-full w-full relative overflow-hidden select-none"
      style={{
        backgroundColor: isDark ? "#111b21" : "#ffffff",
      }}
    >
      {/* ── WhatsApp Top Bar ── */}
      <div
        className="px-3 py-2.5 shadow-sm flex items-center gap-3 text-white flex-shrink-0 transition-colors"
        style={{
          backgroundColor: isDark ? "#202c33" : "#008069",
        }}
      >
        <button
          onClick={() => {
            setShowNewConv(false);
            setSearch("");
            setEmployees([]);
          }}
          className="p-1 -m-1 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white flex items-center justify-center"
          aria-label="Back"
        >
          <BackIcon className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold m-0 leading-tight">
            {isRtl ? "جهة اتصال جديدة" : "New Chat"}
          </h2>
          <p className="text-xs text-white/80 m-0 truncate">
            {availableEmployees.length > 0
              ? `${availableEmployees.length} ${
                  isRtl ? "زميل متاح" : "colleagues available"
                }`
              : isRtl
                ? "دليل الزملاء"
                : "Colleagues directory"}
          </p>
        </div>
      </div>

      {/* ── WhatsApp Search Bar ── */}
      <div
        className="px-3 py-2 border-b flex-shrink-0"
        style={{
          backgroundColor: isDark ? "#111b21" : "#f0f2f5",
          borderColor: isDark ? "#202c33" : "#e9edef",
        }}
      >
        <div
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-colors"
          style={{
            backgroundColor: isDark ? "#202c33" : "#ffffff",
            borderColor: isDark ? "#2a3942" : "#e9edef",
          }}
        >
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={(e) => searchEmployees(e.target.value)}
            placeholder={
              isRtl ? "ابحث عن اسم أو وظيفة..." : "Search name or title..."
            }
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400"
            style={{ direction: isRtl ? "rtl" : "ltr" }}
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setEmployees([]);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Employees List ── */}
      <div
        className="flex-1 overflow-y-auto px-2 py-2 divide-y"
        style={{
          WebkitOverflowScrolling: "touch",
          borderColor: isDark ? "#202c33" : "#f0f2f5",
        }}
      >
        {searching ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-[#00a884] animate-spin mb-2" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isRtl ? "جاري البحث في الدليل..." : "Searching directory..."}
            </span>
          </div>
        ) : availableEmployees.length > 0 ? (
          <div className="space-y-1">
            {availableEmployees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => startConversation(emp)}
                disabled={sending}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 transition-colors text-start"
                style={{
                  direction: isRtl ? "rtl" : "ltr",
                }}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {emp.photoUrl ? (
                    <img
                      src={emp.photoUrl}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover border border-black/5 dark:border-white/10"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-xs"
                      style={{
                        backgroundColor: "#00a884",
                      }}
                    >
                      {emp.firstName?.[0] || "?"}
                      {emp.lastName?.[0] || ""}
                    </div>
                  )}
                  {onlineEmployees.has(emp.id) && (
                    <span className="absolute bottom-0 end-0 w-3 h-3 bg-[#25d366] border-2 border-white dark:border-[#111b21] rounded-full" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div
                      className="font-semibold text-[15px] truncate"
                      style={{ color: isDark ? "#e9edef" : "#111b21" }}
                    >
                      {emp.firstName} {emp.lastName}
                    </div>
                    {onlineEmployees.has(emp.id) && (
                      <span className="text-[11px] font-semibold text-[#00a884] flex items-center gap-1 flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] animate-pulse"></span>
                        {isRtl ? "متصل الآن" : "Online"}
                      </span>
                    )}
                  </div>
                  {(emp.jobTitle || emp.department) && (
                    <div
                      className="text-xs truncate mt-0.5"
                      style={{ color: isDark ? "#8696a0" : "#667781" }}
                    >
                      {emp.jobTitle || emp.department}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{
                backgroundColor: isDark ? "#202c33" : "#e7f8f3",
              }}
            >
              <Search className="w-6 h-6 text-[#00a884]" />
            </div>
            <p className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">
              {search.trim()
                ? isRtl
                  ? "لم يتم العثور على زملاء مطابقين"
                  : "No matching colleagues found"
                : isRtl
                  ? "اكتب اسم الزميل لبدء محادثة فورية"
                  : "Type a colleague name to start chatting"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isRtl
                ? "يمكنك البحث بالاسم الأول، الاسم الأخير، أو المسمى الوظيفي"
                : "Search by first name, last name, or job title"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
