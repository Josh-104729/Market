export type PaymentDuration = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'each_time';

export function formatPaymentDuration(duration?: PaymentDuration | null) {
  switch (duration) {
    case 'hourly':
      return 'Hourly';
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'each_time':
      return 'Each time';
    default:
      return 'Each time';
  }
}

export function formatPaymentDurationSuffix(duration?: PaymentDuration | null) {
  switch (duration) {
    case 'hourly':
      return '/ hr';
    case 'daily':
      return '/ day';
    case 'weekly':
      return '/ wk';
    case 'monthly':
      return '/ mo';
    case 'each_time':
      return '/ each';
    default:
      return '/ each';
  }
}


