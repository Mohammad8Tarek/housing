import { Users, Mail, Phone, Briefcase, MapPin, Info } from "lucide-react";
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
      <div className="max-w-3xl mx-auto p-4">
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-foreground">
            {isRtl ? "زملاء الغرفة" : "My Roommates"}
          </h2>
          <p className="text-muted2 text-sm mt-1">
            {isRtl
              ? "اتصل بزملائك في نفس الغرفة"
              : "Connect with your roommates"}
          </p>
        </div>
        <div className="flex items-start gap-3 p-6 bg-accent2/5 border border-accent2/20 rounded-2xl">
          <Info className="w-5 h-5 text-accent2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted2">
            {isRtl
              ? "أنت تعيش بمفردك في هذه الغرفة حالياً"
              : "You are alone in this room currently"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6" />
          {isRtl ? "زملاء الغرفة" : "My Roommates"}
        </h2>
        <p className="text-muted2 text-sm mt-1">
          {isRtl
            ? `${roommates.length} زميل/زميلة يعيشون معك في الغرفة`
            : `${roommates.length} roommate${roommates.length !== 1 ? "s" : ""} in your room`}
        </p>
      </div>

      {room && (
        <div className="mb-6 p-4 bg-accent2/5 border border-accent2/20 rounded-2xl flex items-start gap-3">
          <MapPin className="w-5 h-5 text-accent2 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-foreground">
              {isRtl ? "غرفتك" : "Your Room"}
            </div>
            <div className="text-sm text-muted2 mt-0.5">
              {(room.buildingName as string) &&
                `${room.buildingName as string} · `}
              {isRtl ? "رقم الغرفة " : "Room #"} {room.roomNumber as string}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {roommates.map((roommate) => (
          <div
            key={roommate.id}
            className="bg-card border border-border2 rounded-2xl p-5 hover:border-accent2/40 transition-colors group"
          >
            <div className="flex items-start gap-4 mb-4">
              {roommate.photoUrl ? (
                <img
                  src={roommate.photoUrl}
                  alt={roommate.firstName}
                  className="w-16 h-16 rounded-2xl object-cover border border-border2 flex-shrink-0 group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent2 to-accent2/60 flex items-center justify-center text-lg font-bold text-accent2-foreground flex-shrink-0 group-hover:scale-105 transition-transform">
                  {roommate.firstName[0]}
                  {roommate.lastName[0]}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-foreground truncate">
                  {roommate.firstName} {roommate.lastName}
                </h3>
                <div className="flex items-center gap-1 text-xs text-muted2 mt-0.5">
                  <span className="px-2 py-0.5 rounded-full bg-surface">
                    {roommate.employeeCode}
                  </span>
                </div>
                {roommate.jobTitle && (
                  <p className="text-xs text-muted2 mt-1">
                    {roommate.jobTitle}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-surface rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-4 h-4 text-accent2" />
                </div>
                <div className="text-sm text-foreground">
                  <div className="text-[10px] text-muted2 uppercase tracking-widest">
                    {isRtl ? "القسم" : "Department"}
                  </div>
                  <div className="font-medium">{roommate.department}</div>
                </div>
              </div>

              {roommate.email && (
                <a
                  href={`mailto:${roommate.email}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-surface/50 hover:bg-surface transition-colors group/email"
                >
                  <div className="w-8 h-8 bg-accent2/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover/email:bg-accent2/20 transition-colors">
                    <Mail className="w-4 h-4 text-accent2" />
                  </div>
                  <div className="text-sm text-foreground truncate group-hover/email:underline">
                    {roommate.email}
                  </div>
                </a>
              )}

              {roommate.phone && (
                <a
                  href={`tel:${roommate.phone}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-surface/50 hover:bg-surface transition-colors group/phone"
                >
                  <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover/phone:bg-green-500/20 transition-colors">
                    <Phone className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="text-sm text-foreground group-hover/phone:underline">
                    {roommate.phone}
                  </div>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-5 bg-card border border-border2 rounded-2xl">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-accent2" />
          {isRtl ? "نصائح التواصل" : "Communication Tips"}
        </h3>
        <ul className="space-y-2 text-sm text-muted2">
          <li className="flex gap-2">
            <span className="text-accent2 font-bold">•</span>
            <span>
              {isRtl
                ? "احترم خصوصية زملائك في الغرفة"
                : "Respect your roommates' privacy"}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent2 font-bold">•</span>
            <span>
              {isRtl
                ? "تواصل بشأن أوقات العمل والراحة"
                : "Communicate about work and rest schedules"}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent2 font-bold">•</span>
            <span>
              {isRtl
                ? "الحفاظ على نظافة الغرفة المشتركة"
                : "Keep shared spaces clean and organized"}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent2 font-bold">•</span>
            <span>
              {isRtl
                ? "التعامل بأدب مع الضيوف"
                : "Be respectful when guests visit"}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
