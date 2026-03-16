type SearchableProfile = {
  contact?: string | null;
  name?: string | null;
  username?: string | null;
};

type SearchablePairing = {
  student?: SearchableProfile | null;
  teacher?: SearchableProfile | null;
};

export function filterAdminPairings<T extends SearchablePairing>(
  pairings: readonly T[],
  search: string,
): T[] {
  const term = search.trim().toLowerCase();
  if (!term) {
    return pairings.slice();
  }

  return pairings.filter((pairing) => {
    const haystack = [
      pairing.student?.name ?? "",
      pairing.student?.username ?? "",
      pairing.student?.contact ?? "",
      pairing.teacher?.name ?? "",
      pairing.teacher?.username ?? "",
      pairing.teacher?.contact ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });
}

export function paginateAdminPairings<T>(
  pairings: readonly T[],
  page: number,
  pageSize: number,
) {
  const totalPages = Math.max(1, Math.ceil(pairings.length / pageSize));
  const currentPage = clampPage(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;

  return {
    currentPage,
    pageItems: pairings.slice(startIndex, startIndex + pageSize),
    totalPages,
  };
}

export function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}
