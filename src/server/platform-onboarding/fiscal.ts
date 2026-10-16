export type OrganizationFiscalData = {
  organization_id: string | null;
  organization_name: string;
  legal_name: string | null;
  legal_form: string | null;
  tax_id_type: string | null;
  tax_id: string | null;
  vat_condition: string | null;
  fiscal_address: string | null;
  city: string | null;
  province: string | null;
  email: string | null;
  iibb_category: string | null;
  iibb_jurisdiction: string | null;
  has_fiscal_data: boolean;
};

type FiscalClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: OrganizationFiscalData | null; error: { message: string } | null }>;
};

export async function getOrganizationFiscalData(client: unknown, caseId: string) {
  try {
    const { data, error } = await (client as FiscalClient).rpc("platform_onboarding_get_fiscal_data", {
      p_case_id: caseId,
    });
    if (error) return { status: "error" as const, data: null };
    if (!data) return { status: "pending" as const, data: null };
    return {
      status: data.has_fiscal_data ? ("available" as const) : ("pending" as const),
      data,
    };
  } catch {
    return { status: "error" as const, data: null };
  }
}
