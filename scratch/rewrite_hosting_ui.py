import os

file_path = r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\pages\hosting-requests\HostingRequestDetail.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We'll replace the return statement with a more premium UI.
# Find the start of the return statement
return_start = content.find("  return (\n    <div className=\"space-y-6 p-1\">")
if return_start == -1:
    print("Could not find return statement")
    exit(1)

new_return = """  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-background to-primary/10 border border-primary/10 shadow-sm p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/hosting-requests")} className="mt-1 shrink-0 rounded-full hover:bg-background/60">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-black tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  {request.requestNumber}
                </h1>
                <StatusBadge
                  label={
                    request.status === "approved" ? (ar ? "معتمد" : "Approved") :
                    request.status === "rejected" ? (ar ? "مرفوض" : "Rejected") :
                    request.status === "in_signing" ? (ar ? "قيد التوقيع" : "In Signing") :
                    request.status
                  }
                  variant={statusBadgeVariant[request.status] ?? "muted"}
                  className="px-3 py-1 text-sm shadow-sm"
                />
              </div>
              <p className="text-muted-foreground text-base mt-2 flex items-center gap-2 font-medium">
                <Users className="w-4 h-4" /> {request.employeeName}
                <span className="text-border">•</span>
                <span className="text-foreground/80">{request.department}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canEdit("hosting_requests") && (
              <Button variant="outline" className="rounded-xl bg-background/50 backdrop-blur-sm border-primary/20 hover:bg-primary/5 hover:text-primary transition-all duration-300" onClick={() => setLocation(`/hosting-requests/${request.id}/edit`)}>
                <Edit className="w-4 h-4 mr-2" />
                {ar ? "تعديل" : "Edit"}
              </Button>
            )}
            {canDelete("hosting_requests") && (
              <Button variant="destructive" className="rounded-xl shadow-sm hover:shadow-md transition-all duration-300" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                {ar ? "حذف" : "Delete"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-0 shadow-xl shadow-primary/5 overflow-hidden rounded-3xl bg-card/80 backdrop-blur-xl">
            <CardHeader className="bg-muted/30 border-b px-8 py-5">
              <CardTitle className="text-xl flex items-center gap-2 text-primary">
                <Users className="w-5 h-5" />
                {ar ? "تفاصيل الطلب" : "Request Details"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <span className="text-[11px] tracking-wider uppercase text-muted-foreground font-bold">{ar ? "الموظف" : "EMPLOYEE"}</span>
                  <p className="text-lg font-semibold text-foreground">{request.employeeName}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] tracking-wider uppercase text-muted-foreground font-bold">{ar ? "الرقم الوظيفي" : "CLOCK NUMBER"}</span>
                  <p className="text-lg font-semibold text-foreground">{request.clockNumber || "-"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] tracking-wider uppercase text-muted-foreground font-bold">{ar ? "الوظيفة" : "POSITION"}</span>
                  <p className="text-lg font-semibold text-foreground">{request.position || "-"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] tracking-wider uppercase text-muted-foreground font-bold">{ar ? "القسم" : "DEPARTMENT"}</span>
                  <p className="text-lg font-semibold text-foreground">{request.department || "-"}</p>
                </div>

                <div className="col-span-1 sm:col-span-2 h-px bg-border my-2" />

                <div className="space-y-1">
                  <span className="text-[11px] tracking-wider uppercase text-muted-foreground font-bold">{ar ? "تاريخ الوصول" : "CHECK-IN DATE"}</span>
                  <div className="flex items-center gap-2 text-foreground font-semibold bg-muted/40 w-fit px-4 py-2 rounded-xl">
                    <Clock className="w-4 h-4 text-primary" />
                    {request.fromDate ? new Date(request.fromDate).toLocaleDateString('en-GB') : "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] tracking-wider uppercase text-muted-foreground font-bold">{ar ? "تاريخ المغادرة" : "CHECK-OUT DATE"}</span>
                  <div className="flex items-center gap-2 text-foreground font-semibold bg-muted/40 w-fit px-4 py-2 rounded-xl">
                    <Clock className="w-4 h-4 text-primary" />
                    {request.toDate ? new Date(request.toDate).toLocaleDateString('en-GB') : "-"}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] tracking-wider uppercase text-muted-foreground font-bold">{ar ? "عدد الغرف" : "ROOMS REQUIRED"}</span>
                  <p className="text-2xl font-black text-primary">{request.numberOfRooms || "-"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] tracking-wider uppercase text-muted-foreground font-bold">{ar ? "أفراد العائلة" : "FAMILY MEMBERS"}</span>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-black text-primary">{request.familyMembersCount}</p>
                    {request.familyMembersIncluded && <span className="text-sm font-medium text-muted-foreground">({request.familyMembersIncluded})</span>}
                  </div>
                </div>

                {request.assignedRoomNumber && (
                  <div className="col-span-1 sm:col-span-2 space-y-1 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <span className="text-[11px] tracking-wider uppercase text-primary font-bold">{ar ? "غرفة الاستضافة المعينة" : "ASSIGNED HOSTING ROOM"}</span>
                    <p className="text-xl font-bold text-foreground">{request.assignedRoomNumber}</p>
                  </div>
                )}

                {request.remarks && (
                  <div className="col-span-1 sm:col-span-2 space-y-2 mt-2 bg-muted/30 p-5 rounded-2xl">
                    <span className="text-[11px] tracking-wider uppercase text-muted-foreground font-bold">{ar ? "ملاحظات" : "REMARKS"}</span>
                    <p className="font-medium text-foreground/80 leading-relaxed">{request.remarks}</p>
                  </div>
                )}
                
                {request.attachmentData && (
                  <div className="col-span-1 sm:col-span-2 pt-4">
                    <a href={request.attachmentData} download="attachment" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-6 py-3 rounded-xl font-semibold shadow-sm hover:shadow-md">
                      <ExternalLink className="w-4 h-4" />
                      {ar ? "عرض المرفقات" : "View Attachments"}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Housing Card — الحالة السكنية */}
          {request.status === "approved" && (
            <Card className="border-0 shadow-xl shadow-primary/5 overflow-hidden rounded-3xl bg-card/80 backdrop-blur-xl relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
              <CardHeader className="bg-muted/30 border-b px-8 py-5">
                <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                  <Home className="w-5 h-5 text-emerald-500" />
                  {ar ? "السكن والاستضافة" : "Housing & Accommodation"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {request.guestHostingId ? (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background border p-5 rounded-2xl shadow-sm">
                      <div className="space-y-1.5">
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                          {ar ? "طلب الاستضافة المرتبط" : "Linked Guest Hosting"}
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-black text-foreground">#{request.guestHostingId}</span>
                          {hostingStatusLabel && (
                            <StatusBadge
                              label={ar ? hostingStatusLabel.ar : hostingStatusLabel.en}
                              variant={hostingStatusVariant}
                              className="px-3 py-1"
                            />
                          )}
                        </div>
                      </div>
                      <Button
                        variant="default"
                        className="rounded-xl shadow-sm hover:shadow-md"
                        onClick={() => setLocation(`/accommodation/guest-hosting`)}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {ar ? "عرض السجل" : "View Record"}
                      </Button>
                    </div>

                    {guestHosting && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-muted/40 rounded-2xl">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground font-medium">{ar ? "الضيوف" : "Guests"}</span>
                          <p className="font-bold text-lg">{guestHosting.guestsCount}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground font-medium">{ar ? "من" : "From"}</span>
                          <p className="font-bold text-lg">{new Date(guestHosting.expectedFrom).toLocaleDateString()}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground font-medium">{ar ? "إلى" : "To"}</span>
                          <p className="font-bold text-lg">{new Date(guestHosting.expectedTo).toLocaleDateString()}</p>
                        </div>
                        {guestHosting.roomId && (
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground font-medium">{ar ? "الغرفة" : "Room"}</span>
                            <p className="font-bold text-lg text-primary">{guestHosting.roomId}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 rounded-2xl text-center space-y-4">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center text-amber-600 mb-2">
                      <Home className="w-8 h-8" />
                    </div>
                    <p className="text-base text-amber-800 dark:text-amber-300 font-medium max-w-md leading-relaxed">
                      {ar
                        ? "تم اعتماد الطلب بنجاح، ولكن لم يتم إنشاء سجل الاستضافة تلقائياً. يمكنك إنشاؤه الآن."
                        : "Request approved successfully, but Guest Hosting record was not created automatically. You can create it now."}
                    </p>
                    <Button
                      size="lg"
                      className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm hover:shadow-md mt-2 transition-all"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/hosting-requests/${requestId}/create-guest-hosting`, { method: "POST" });
                          const json = await res.json();
                          if (!res.ok) throw new Error(json.message || "Failed to create guest hosting");
                          toast.success(ar ? "تم إنشاء الاستضافة بنجاح" : "Guest hosting created successfully");
                          refetch();
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                    >
                      <Home className="w-5 h-5 mr-2" />
                      {ar ? "إنشاء سجل الاستضافة" : "Create Guest Hosting"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Approval Chain */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card/80 backdrop-blur-xl text-card-foreground shadow-xl shadow-primary/5 rounded-3xl border-0 p-8 sticky top-6">
            <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              {ar ? "مسار الاعتماد" : "Approval Workflow"}
            </h2>
            
            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {steps.length === 0 ? (
                <div className="text-center p-6 text-muted-foreground">
                  {ar ? "لا توجد خطوات اعتماد" : "No approval steps"}
                </div>
              ) : (
                steps.map((step: any, idx: number) => {
                  const roleKey = approvalRoleKey(step.roleRequired);
                  const roleName = stepRoles[roleKey]?.[language] ?? step.roleRequired;
                  const { signed: isSigned, rejected: isRejected, returned: isReturned, active: isActive } = getStepState(step);

                  let statusColor = "bg-muted border-border text-muted-foreground";
                  let glowClass = "";
                  if (isSigned) {
                    statusColor = "bg-emerald-500 border-emerald-500 text-white";
                    glowClass = "shadow-[0_0_15px_rgba(16,185,129,0.3)]";
                  } else if (isRejected) {
                    statusColor = "bg-red-500 border-red-500 text-white";
                    glowClass = "shadow-[0_0_15px_rgba(239,68,68,0.3)]";
                  } else if (isReturned) {
                    statusColor = "bg-amber-500 border-amber-500 text-white";
                    glowClass = "shadow-[0_0_15px_rgba(245,158,11,0.3)]";
                  } else if (isActive) {
                    statusColor = "bg-primary border-primary text-primary-foreground";
                    glowClass = "shadow-[0_0_20px_rgba(var(--primary),0.4)] animate-pulse";
                  }

                  return (
                    <div key={step.id} className="relative flex items-start gap-4">
                      {/* Timeline Dot */}
                      <div className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${statusColor} ${glowClass}`}>
                        {isSigned ? <CheckCircle className="w-5 h-5" /> :
                         isRejected ? <XCircle className="w-5 h-5" /> :
                         isReturned ? <ArrowLeft className="w-5 h-5" /> :
                         isActive ? <Clock className="w-5 h-5" /> :
                         <Users className="w-5 h-5" />}
                      </div>
                      
                      {/* Content Box */}
                      <div className={`flex-1 rounded-2xl border bg-background/50 p-4 transition-all duration-300 hover:shadow-md ${isActive ? 'border-primary/40 shadow-sm' : 'border-border'}`}>
                        <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-1 block">
                          {roleName}
                        </span>
                        
                        <h4 className="text-sm font-bold text-foreground mb-1 line-clamp-1">
                          {step.signerName || step.signed_by_user_id || (ar ? "في انتظار التوقيع" : "Pending Signature")}
                        </h4>
                        
                        {step.signedAt && (
                          <span className="text-[11px] text-muted-foreground block mb-3">
                            {new Date(step.signedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        )}

                        {step.signatureImageUrlSnapshot && (
                          <div className="mt-3 bg-white p-2 rounded-xl border shadow-sm flex items-center justify-center">
                            <img src={step.signatureImageUrlSnapshot} alt="Signature" className="max-h-12 object-contain" />
                          </div>
                        )}

                        {/* Action Buttons for Active Step */}
                        {(isActive && userCanAct) && (
                          <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
                            {!userHasSignature ? (
                              <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-700 p-3 rounded-xl text-center">
                                <p className="text-xs font-medium leading-tight mb-2">
                                  {ar ? "يرجى رفع توقيعك في الإعدادات قبل الاعتماد" : "Please upload your signature in Settings before signing"}
                                </p>
                                <Button variant="outline" size="sm" className="w-full text-xs h-8 rounded-lg" onClick={() => setLocation("/settings")}>
                                  {ar ? "الذهاب للإعدادات" : "Go to Settings"}
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Button className="w-full text-xs h-9 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all" onClick={() => signMutation.mutate()} disabled={signMutation.isPending}>
                                  {signMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                  {ar ? "اعتماد الطلب" : "Approve Request"}
                                </Button>
                                <div className="grid grid-cols-2 gap-2">
                                  <Button variant="outline" className="w-full text-xs h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all" onClick={() => setShowRejectDialog(true)}>
                                    <XCircle className="w-4 h-4 mr-1" />
                                    {ar ? "رفض" : "Reject"}
                                  </Button>
                                  {currentStep?.stepOrder > 1 ? (
                                    <Button variant="outline" className="w-full text-xs h-9 rounded-xl border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-all" onClick={() => setShowRebackDialog(true)}>
                                      <ArrowLeft className="w-4 h-4 mr-1" />
                                      {ar ? "إرجاع" : "Return"}
                                    </Button>
                                  ) : <div/>}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dialogs within the sidebar for easy access context */}
            {(showRejectDialog || showRebackDialog) && request.status === "in_signing" && currentStep && (
              <div className="mt-6">
                {showRebackDialog && (
                  <div className="p-5 border rounded-2xl shadow-lg bg-background border-amber-200/60 animate-in slide-in-from-bottom-4 duration-300">
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4" />
                      {ar ? "سبب إرجاع الطلب للمرحلة السابقة" : "Reason for Returning Request"}
                    </h4>
                    <Textarea
                      rows={3}
                      value={rebackReason}
                      onChange={(e) => setRebackReason(e.target.value)}
                      placeholder={ar ? "اكتب سبب إرجاع الطلب هنا..." : "Enter reason for returning..."}
                      className="resize-none rounded-xl bg-muted/50 border-amber-100 focus-visible:ring-amber-500 mb-4"
                    />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => rebackMutation.mutate()}
                        disabled={!rebackReason.trim() || rebackMutation.isPending}
                      >
                        {rebackMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {ar ? "تأكيد" : "Confirm"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-xl hover:bg-muted"
                        onClick={() => { setShowRebackDialog(false); setRebackReason(""); }}
                      >
                        {ar ? "إلغاء" : "Cancel"}
                      </Button>
                    </div>
                  </div>
                )}

                {showRejectDialog && (
                  <div className="p-5 border rounded-2xl shadow-lg bg-background border-red-200/60 animate-in slide-in-from-bottom-4 duration-300">
                    <h4 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      {ar ? "سبب الرفض النهائي" : "Reason for Final Rejection"}
                    </h4>
                    <Textarea
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={ar ? "اكتب سبب الرفض هنا..." : "Enter rejection reason..."}
                      className="resize-none rounded-xl bg-muted/50 border-red-100 focus-visible:ring-red-500 mb-4"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1 rounded-xl"
                        onClick={() => rejectMutation.mutate()}
                        disabled={!rejectReason.trim() || rejectMutation.isPending}
                      >
                        {rejectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {ar ? "تأكيد الرفض" : "Confirm Reject"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-xl hover:bg-muted"
                        onClick={() => { setShowRejectDialog(false); setRejectReason(""); }}
                      >
                        {ar ? "إلغاء" : "Cancel"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatedConfirmModal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={ar ? "حذف الطلب" : "Delete Request"}
        description={ar ? "هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء." : "Are you sure you want to delete this request? This action cannot be undone."}
        confirmLabel={ar ? "حذف" : "Delete"}
        cancelLabel={ar ? "إلغاء" : "Cancel"}
        variant="destructive"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          deleteMutation.mutate();
        }}
      />
    </div>
  );
}
"""

new_content = content[:return_start] + new_return

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Replaced UI successfully")
