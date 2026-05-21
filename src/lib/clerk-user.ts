type ClerkDisplayUser = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
};

function cleanDisplayName(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function getClerkDisplayName(user: ClerkDisplayUser | null | undefined): string | undefined {
  const fullName = cleanDisplayName(user?.fullName);
  if (fullName) return fullName;

  const nameParts = [user?.firstName, user?.lastName]
    .map((part) => cleanDisplayName(part))
    .filter(Boolean);
  if (nameParts.length > 0) return nameParts.join(" ");

  return cleanDisplayName(user?.username);
}
