import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  BotIdentityCandidate,
  BotIdentityChannel,
  BotIdentityRepository,
} from "../../lib/bot-identity/identity-types";
import { BotIdentityRepositoryError } from "./identity-errors";

type ChannelUserRow = {
  id: string;
  organization_id: string;
  residente_id: string | null;
  status: "active" | "blocked" | "inactive";
};

type ResidentRow = {
  id: string;
  organization_id: string;
  activo: boolean;
};

type OrganizationRow = {
  id: string;
  status: string;
};

type LinkRow = {
  organization_id: string;
  unidad_id: string;
};

type UnitRow = {
  id: string;
  numero: string | null;
  edificio_id: string;
  organization_id: string;
};

type BuildingRow = {
  id: string;
  organization_id: string;
  nombre: string | null;
};

async function read<T>(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>): Promise<T[]> {
  const result = await query;
  if (result.error) throw new BotIdentityRepositoryError();
  return (Array.isArray(result.data) ? result.data : []) as T[];
}

class SupabaseBotIdentityRepository implements BotIdentityRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findChannelCandidates(channel: BotIdentityChannel, externalSenderId: string): Promise<BotIdentityCandidate[]> {
    const channelUsers = await read<ChannelUserRow>(
      this.client
        .from("channel_users")
        .select("id, organization_id, residente_id, status")
        .eq("channel", channel)
        .eq("channel_user_id", externalSenderId),
    );

    const candidates: BotIdentityCandidate[] = [];
    for (const channelUser of channelUsers) {
      const organizationRows = await read<OrganizationRow>(
        this.client.from("organizations").select("id, status").eq("id", channelUser.organization_id),
      );
      if (organizationRows.length !== 1) throw new BotIdentityRepositoryError();

      const organization = organizationRows[0];
      let resident: ResidentRow | null = null;
      if (channelUser.residente_id !== null) {
        const residentRows = await read<ResidentRow>(
          this.client.from("residentes").select("id, organization_id, activo").eq("id", channelUser.residente_id),
        );
        if (residentRows.length !== 1) throw new BotIdentityRepositoryError();
        resident = residentRows[0];
      }

      const links = resident
        ? await read<LinkRow>(
            this.client
              .from("resident_unit_links")
              .select("organization_id, unidad_id")
              .eq("residente_id", resident.id)
              .eq("active", true),
          )
        : [];

      const units = links.length
        ? await read<UnitRow>(
            this.client
              .from("unidades")
              .select("id, numero, edificio_id, organization_id")
              .in(
                "id",
                links.map((link) => link.unidad_id),
              ),
          )
        : [];
      const buildings = units.length
        ? await read<BuildingRow>(
            this.client
              .from("edificios")
              .select("id, organization_id, nombre")
              .in(
                "id",
                units.map((unit) => unit.edificio_id),
              ),
          )
        : [];

      candidates.push({
        channelUserId: channelUser.id,
        channelUserStatus: channelUser.status,
        organizationId: channelUser.organization_id,
        organizationStatus: organization.status,
        residentId: resident?.id ?? null,
        residentOrganizationId: resident?.organization_id ?? null,
        residentActive: resident?.activo ?? null,
        links: links.map((link) => {
          const unit = units.find((item) => item.id === link.unidad_id);
          const building = unit ? buildings.find((item) => item.id === unit.edificio_id) : undefined;
          return {
            organizationId: link.organization_id,
            unitId: link.unidad_id,
            unitNumber: unit?.numero ?? null,
            unitOrganizationId: unit?.organization_id ?? null,
            consorcioId: unit?.edificio_id ?? null,
            consorcioOrganizationId: building?.organization_id ?? null,
            consorcioLabel: building?.nombre ?? null,
          };
        }),
      });
    }

    return candidates;
  }
}

export function createServerBotIdentityRepository(): BotIdentityRepository {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new BotIdentityRepositoryError();

  return new SupabaseBotIdentityRepository(createClient(supabaseUrl, serviceRoleKey));
}
