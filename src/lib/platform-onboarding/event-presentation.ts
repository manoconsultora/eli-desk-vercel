type EventSummary = { action: string; outcome: string; metadata: Record<string, unknown> };

export function onboardingEventLabel(event: EventSummary, previous?: EventSummary): string {
  if (event.action === "case_created") return "Alta recibida";
  if (event.action === "intake_updated") {
    const payment = event.metadata.payment_status;
    const previousPayment = previous?.metadata.payment_status ?? "not_started";
    if (payment !== previousPayment) {
      if (payment === "approved") return "Pago aprobado";
      if (payment === "pending") return "Pago pendiente de confirmación";
      if (payment === "rejected") return "Pago rechazado";
      if (payment === "failed") return "Error al procesar el pago";
    }
    if (
      event.metadata.onboarding_progress === "checkout_started" &&
      previous?.metadata.onboarding_progress !== "checkout_started"
    ) {
      return "Checkout iniciado";
    }
    return "Datos del alta actualizados";
  }
  const labels: Record<string, string> = {
    start_review: "Revisión iniciada",
    commercial_review: "Revisión comercial iniciada",
    cancel: "Registro cancelado",
    reject: "Registro rechazado",
    reopen: "Registro reabierto",
    retry: "Reintento solicitado",
    mark_duplicate: "Registro vinculado como duplicado",
    commercial_approved: "Condiciones comerciales registradas",
    organization_provisioned: "Organización creada",
    owner_acceptance_verified: "Confirmación del titular verificada",
    initial_property_created: "Primer consorcio creado",
    activation_completed: "Activación completada",
    internal_free_revoked: "Acceso gratuito interno revocado",
    provisioning_failed: "Error al crear la organización",
    activation_failed: "Error de activación",
  };
  return labels[event.action] ?? "Actividad registrada";
}
