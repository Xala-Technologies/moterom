import { AppError } from "../shared/validation";
import type { RegistrySource, RegistryStatus } from "../shared/types";
import { isValidOrgNumber, normalizeOrgNumber } from "./orgNumber";

export type BrregLookupResult = {
  organizationNumber: string;
  name: string;
  registryStatus: RegistryStatus;
  registrySource: RegistrySource;
  snapshot: string;
};

type FixtureEntry = {
  name: string;
  inFrivillighetsregisteret: boolean;
};

/**
 * Real Norwegian organisations used in the FHH demo.
 * Numbers are valid Modulus-11 and match Enhetsregisteret;
 * Frivillighetsregisteret flags match live Brreg checks (2026-10).
 */
const FIXTURES: Record<string, FixtureEntry> = {
  "957914330": {
    name: "KFUK-KFUM Norge",
    inFrivillighetsregisteret: true,
  },
  "988144800": {
    name: "Frivillighet Norge",
    inFrivillighetsregisteret: true,
  },
  "971274018": {
    name: "Norges KFUK KFUM Speidere",
    inFrivillighetsregisteret: true,
  },
  "919181206": {
    name: "Frivillighetens Hus",
    inFrivillighetsregisteret: true,
  },
  "871033552": {
    name: "Norsk Folkehjelp",
    inFrivillighetsregisteret: true,
  },
  "954877841": {
    name: "Norges Speiderforbund",
    inFrivillighetsregisteret: true,
  },
  "944384448": {
    name: "Stiftelsen Kirkens Bymisjon",
    inFrivillighetsregisteret: true,
  },
  // Negative path for tests / walkthrough (not a real entity).
  "999999999": {
    name: "Demo Uregistrert AS",
    inFrivillighetsregisteret: false,
  },
};

function brregMode(): "live" | "fixture" {
  const mode = (process.env.BRREG_MODE || "fixture").toLowerCase();
  return mode === "live" ? "live" : "fixture";
}

export async function lookupOrganization(
  rawOrgNumber: string,
): Promise<BrregLookupResult> {
  const organizationNumber = normalizeOrgNumber(rawOrgNumber);
  if (!isValidOrgNumber(organizationNumber)) {
    throw new AppError(
      400,
      "Ugyldig organisasjonsnummer.",
      "invalid_organization_number",
    );
  }

  if (brregMode() === "fixture") {
    const fixture = FIXTURES[organizationNumber];
    if (!fixture) {
      return {
        organizationNumber,
        name: `Organisasjonsnummer ${organizationNumber}`,
        registryStatus: "not_registered",
        registrySource: "demo_fixture",
        snapshot: JSON.stringify({ fixture: true, found: false }),
      };
    }
    return {
      organizationNumber,
      name: fixture.name,
      registryStatus: fixture.inFrivillighetsregisteret
        ? "verified"
        : "not_registered",
      registrySource: "demo_fixture",
      snapshot: JSON.stringify({
        fixture: true,
        navn: fixture.name,
        registrertIFrivillighetsregisteret: fixture.inFrivillighetsregisteret,
      }),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://data.brreg.no/enhetsregisteret/api/enheter/${organizationNumber}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) {
      return {
        organizationNumber,
        name: organizationNumber,
        registryStatus: "not_registered",
        registrySource: "brreg",
        snapshot: JSON.stringify({ status: 404 }),
      };
    }
    if (!res.ok) {
      return {
        organizationNumber,
        name: organizationNumber,
        registryStatus: "verification_failed",
        registrySource: "brreg",
        snapshot: JSON.stringify({ status: res.status }),
      };
    }
    const body = (await res.json()) as {
      navn?: string;
      registrertIFrivillighetsregisteret?: boolean;
    };
    const registered = body.registrertIFrivillighetsregisteret === true;
    return {
      organizationNumber,
      name: (body.navn || organizationNumber).trim(),
      registryStatus: registered ? "verified" : "not_registered",
      registrySource: "brreg",
      snapshot: JSON.stringify(body),
    };
  } catch {
    return {
      organizationNumber,
      name: organizationNumber,
      registryStatus: "verification_failed",
      registrySource: "brreg",
      snapshot: JSON.stringify({ error: "unreachable" }),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function searchOrganizations(
  query: string,
): Promise<Array<{ organizationNumber: string; name: string }>> {
  const q = query.trim();
  if (q.length < 2) return [];
  const asNumber = normalizeOrgNumber(q);
  if (/^\d{9}$/.test(asNumber)) {
    const hit = await lookupOrganization(asNumber);
    return [{ organizationNumber: hit.organizationNumber, name: hit.name }];
  }

  if (brregMode() === "fixture") {
    const lower = q.toLowerCase();
    return Object.entries(FIXTURES)
      .filter(([, v]) => v.name.toLowerCase().includes(lower))
      .map(([organizationNumber, v]) => ({
        organizationNumber,
        name: v.name,
      }));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = new URL("https://data.brreg.no/enhetsregisteret/api/enheter");
    url.searchParams.set("navn", q);
    url.searchParams.set("size", "10");
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      _embedded?: {
        enheter?: Array<{ organisasjonsnummer?: string; navn?: string }>;
      };
    };
    return (body._embedded?.enheter || [])
      .map((e) => ({
        organizationNumber: normalizeOrgNumber(e.organisasjonsnummer || ""),
        name: (e.navn || "").trim(),
      }))
      .filter((e) => e.organizationNumber.length === 9 && e.name);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
