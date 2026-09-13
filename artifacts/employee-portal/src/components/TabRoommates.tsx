import { Users, Mail, Phone, Briefcase, MapPin, Info, MessageSquare, MessageCircle } from "lucide-react";
import { useTheme } from "../lib/theme";

interface Roommate {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode: string;
  email: string;
  phone?: string;
  department: string;
  jobTitle?: string;
  photoUrl?: string;
}

interface Props {
  roommates: Roommate[];
  room?: Record<string, unknown>;
}

export default function TabRoommates({ roommates, room }: Props) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";

  if (!roommates || roommates.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {isRtl ? "زملاء الغرفة" : "My Roommates"}
            </h2>
            <p className="text-muted-foreground text-xs mt-0.5">
              {isRtl ? "التواصل والتعاون مع زملاء السكن" : "Connect with your room members"}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-5 bg-card/75 border border-border/60 rounded-2xl text-start shadow-xs">
          <Info className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {isRtl ? "أنت بمفردك في هذه الغرفة حالياً" : "Single Occupancy Room"}
            </h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {isRtl
                ? "لا يوجد زملاء سكن مسكنون معك في نفس الغرفة في الوقت الحالي."
                : "No other roommates are currently assigned to this room."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            <span>{isRtl ? "زملاء الغرفة" : "Roommates Hub"}</span>
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            {isRtl
              ? `${roommates.length} زميل/زميلة يتشاركون معك الغرفة`
              : `${roommates.length} resident${roommates.length !== 1 ? "s" : ""} sharing this room`}
          </p>
        </div>

        {room && (
          <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold font-mono">
            {isRtl ? "غرفة " : "Room "} {String(room.roomNumber || "")}
          </div>
        )}
      </div>

      {/* Roommate Cards */}
      <div className="space-y-3">
        {roommates.map((roommate) => {
          const cleanPhone = roommate.phone ? roommate.phone.replace(/[^0-9]/g, "") : "";
          const waPhone = cleanPhone.startsWith("01") ? `20${cleanPhone.slice(1)}` : cleanPhone;

          return (
            <div
              key={roommate.id}
              className="bg-card/85 backdrop-blur-md border border-border/60 rounded-2xl p-4 shadow-xs hover:border-purple-500/40 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-3.5 mb-3">
                {roommate.photoUrl ? (
                  <img
                    src={roommate.photoUrl}
                    alt={roommate.firstName}
                    className="w-13 h-13 rounded-2xl object-cover border border-border flex-shrink-0"
                  />
                ) : (
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-purple-500/20 via-primary/20 to-purple-500/10 text-purple-600 dark:text-purple-300 flex items-center justify-center text-base font-black border border-purple-500/30 flex-shrink-0">
                    {roommate.firstName?.[0] || "U"}
                    {roommate.lastName?.[0] || ""}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-sm font-bold text-foreground truncate">
                      {roommate.firstName} {roommate.lastName}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                      {roommate.employeeCode}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {roommate.jobTitle || roommate.department || "Staff Member"}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {isRtl ? "مُقيم نشط" : "In Residence"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                {/* WhatsApp */}
                {waPhone ? (
                  <a
                    href={`https://wa.me/${waPhone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors cursor-pointer border border-emerald-500/20"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-muted/40 text-muted-foreground/60 text-xs font-semibold">
                    <span>{isRtl ? "لا يوجد واتساب" : "No WhatsApp"}</span>
                  </div>
                )}

                {/* Direct Call */}
                {roommate.phone ? (
                  <a
                    href={`tel:${roommate.phone}`}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold transition-colors cursor-pointer border border-blue-500/20"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{isRtl ? "اتصال" : "Call"}</span>
                  </a>
                ) : (
                  <a
                    href={`mailto:${roommate.email || ""}`}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isRtl ? "بريد" : "Email"}</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
