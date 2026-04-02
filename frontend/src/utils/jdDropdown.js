const getSafeText = (value, fallback = 'N/A') => {
  const text = (value ?? '').toString().trim();
  return text || fallback;
};

const getCreatedRaw = (jd) => {
  return (
    jd?.created_at ||
    jd?.createdAt ||
    jd?.created_on ||
    jd?.createdOn ||
    jd?.Created_At ||
    jd?.CreatedAt ||
    ''
  );
};

const formatCreatedDate = (rawValue) => {
  if (!rawValue) return 'N/A';
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return rawValue.toString().slice(0, 10);
  }
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const shorten = (value, maxLength = 26) => {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
};

const getCreatedSortValue = (jd) => {
  const rawValue = getCreatedRaw(jd);
  const parsed = rawValue ? new Date(rawValue) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return parsed.getTime();
  }

  const fallbackText = rawValue ? rawValue.toString() : '';
  return fallbackText ? Date.parse(fallbackText) || 0 : 0;
};

export const buildJdDropdownOption = (jd, config = {}) => {
  const { maxRoleLength = 26 } = config;
  const id = getSafeText(jd?.jd_id || jd?.JD_ID || jd?.id, 'N/A');
  const roleFull = getSafeText(jd?.title || jd?.role || jd?.job_title, 'Untitled Role');
  const createdText = formatCreatedDate(getCreatedRaw(jd));
  const roleShort = shorten(roleFull, maxRoleLength);

  return {
    value: jd?.jd_id || jd?.JD_ID || '',
    label: `${roleShort} | ${id} | ${createdText}`,
    fullLabel: `Role: ${roleFull} | JD ID: ${id} | Created: ${createdText}`
  };
};

export const sortJdsNewestFirst = (jds = []) => {
  return [...jds].sort((left, right) => {
    const rightCreated = getCreatedSortValue(right);
    const leftCreated = getCreatedSortValue(left);
    if (rightCreated !== leftCreated) return rightCreated - leftCreated;

    const rightId = (right?.jd_id || right?.JD_ID || '').toString();
    const leftId = (left?.jd_id || left?.JD_ID || '').toString();
    return rightId.localeCompare(leftId);
  });
};
