export const PROPERTY_TYPE_COLORS = {
  house:           { border: '#C2920E', bg: '#FFFBEB', text: '#92680A', pill: '#FEF3C7' },
  resort:          { border: '#16A34A', bg: '#F0FDF4', text: '#15803D', pill: '#DCFCE7' },
  condo:           { border: '#2563EB', bg: '#EFF6FF', text: '#1D4ED8', pill: '#DBEAFE' },
  resort_house:    { border: '#16A34A', bg: '#F0FDF4', text: '#15803D', pill: '#DCFCE7' },
  condo_apartment: { border: '#2563EB', bg: '#EFF6FF', text: '#1D4ED8', pill: '#DBEAFE' },
};

export function getPropertyTypeColors(type) {
  return PROPERTY_TYPE_COLORS[type] || PROPERTY_TYPE_COLORS.house;
}
