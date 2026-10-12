"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TEAM_ROLE_DESCRIPTIONS, TEAM_ROLES, teamRoleLabel } from "@/server/team/team-roles";

export type CommunityOption = { id: string; name: string };

// Role and consorcios, shared by inviting and editing a member.
export function TeamAccessFields({
  communities,
  role,
  onRoleChange,
  communityIds,
  onCommunityIdsChange,
}: {
  communities: CommunityOption[];
  role: string;
  onRoleChange: (role: string) => void;
  communityIds: string[];
  onCommunityIdsChange: (ids: string[]) => void;
}) {
  function toggle(id: string, checked: boolean) {
    onCommunityIdsChange(checked ? [...communityIds, id] : communityIds.filter((value) => value !== id));
  }

  return (
    <>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-medium text-sm">Rol</legend>
        <RadioGroup value={role} onValueChange={onRoleChange} className="gap-3">
          {TEAM_ROLES.map((value) => (
            <div key={value} className="flex items-start gap-3">
              <RadioGroupItem id={`team-role-${value}`} value={value} className="mt-0.5" />
              <Label htmlFor={`team-role-${value}`} className="block font-normal">
                <span className="font-medium">{teamRoleLabel(value)}</span>
                <span className="block text-muted-foreground text-xs">{TEAM_ROLE_DESCRIPTIONS[value]}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 font-medium text-sm">Consorcios que atiende</legend>
        {communities.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavía no hay consorcios cargados.</p>
        ) : (
          <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
            {communities.map((community) => (
              // Label beside the checkbox, not around it: a wrapping label clicks it a second time.
              <div key={community.id} className="flex items-center gap-2">
                <Checkbox
                  id={`team-community-${community.id}`}
                  checked={communityIds.includes(community.id)}
                  onCheckedChange={(checked) => toggle(community.id, checked === true)}
                />
                <Label htmlFor={`team-community-${community.id}`} className="font-normal">
                  {community.name}
                </Label>
              </div>
            ))}
          </div>
        )}
      </fieldset>
    </>
  );
}
