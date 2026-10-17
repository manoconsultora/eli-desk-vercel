export type InvitationRequest = {
  caseId: string;
  recipientEmail: string;
  role: "TENANT_OWNER";
};

export type InvitationPreparation = {
  state: "deferred_no_send";
  message: "No se envió ningún correo; la entrega real requiere autorización humana.";
};

export type AuthInvitationAdapter = {
  prepare(request: InvitationRequest): Promise<InvitationPreparation>;
};

/** Safe default: records no Auth user and sends no email or invitation. */
export const noSendAuthInvitationAdapter: AuthInvitationAdapter = {
  async prepare() {
    return {
      state: "deferred_no_send",
      message: "No se envió ningún correo; la entrega real requiere autorización humana.",
    };
  },
};
