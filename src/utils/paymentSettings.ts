import { supabase } from '../supabaseClient';

export interface PaymentSettings {
  airtelNumber: string;
  airtelRawNumber: string;
  airtelAccountName: string;
  moovNumber: string;
  moovRawNumber: string;
  moovAccountName: string;
  whatsappNumber: string;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  airtelNumber: '+241 77 65 00 15',
  airtelRawNumber: '077650015',
  airtelAccountName: 'ONG DDB',
  moovNumber: '+241 66 12 34 56',
  moovRawNumber: '066123456',
  moovAccountName: 'ONG DDB',
  whatsappNumber: '241077617776',
};

export const fetchPaymentSettings = async (): Promise<PaymentSettings> => {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('key, value')
      .in('key', [
        'payment.airtel.number',
        'payment.airtel.raw_number',
        'payment.airtel.account_name',
        'payment.moov.number',
        'payment.moov.raw_number',
        'payment.moov.account_name',
        'payment.whatsapp.number',
      ]);

    if (error || !data || data.length === 0) return DEFAULT_PAYMENT_SETTINGS;

    const map: Record<string, string> = {};
    data.forEach((item: any) => { map[item.key] = item.value; });

    return {
      airtelNumber: map['payment.airtel.number'] || DEFAULT_PAYMENT_SETTINGS.airtelNumber,
      airtelRawNumber: map['payment.airtel.raw_number'] || DEFAULT_PAYMENT_SETTINGS.airtelRawNumber,
      airtelAccountName: map['payment.airtel.account_name'] || DEFAULT_PAYMENT_SETTINGS.airtelAccountName,
      moovNumber: map['payment.moov.number'] || DEFAULT_PAYMENT_SETTINGS.moovNumber,
      moovRawNumber: map['payment.moov.raw_number'] || DEFAULT_PAYMENT_SETTINGS.moovRawNumber,
      moovAccountName: map['payment.moov.account_name'] || DEFAULT_PAYMENT_SETTINGS.moovAccountName,
      whatsappNumber: map['payment.whatsapp.number'] || DEFAULT_PAYMENT_SETTINGS.whatsappNumber,
    };
  } catch {
    return DEFAULT_PAYMENT_SETTINGS;
  }
};

export const savePaymentSettings = async (settings: PaymentSettings): Promise<boolean> => {
  try {
    const rows = [
      { key: 'payment.airtel.number', type: 'text', value: settings.airtelNumber },
      { key: 'payment.airtel.raw_number', type: 'text', value: settings.airtelRawNumber },
      { key: 'payment.airtel.account_name', type: 'text', value: settings.airtelAccountName },
      { key: 'payment.moov.number', type: 'text', value: settings.moovNumber },
      { key: 'payment.moov.raw_number', type: 'text', value: settings.moovRawNumber },
      { key: 'payment.moov.account_name', type: 'text', value: settings.moovAccountName },
      { key: 'payment.whatsapp.number', type: 'text', value: settings.whatsappNumber },
    ];

    const { error } = await supabase.from('site_content').upsert(rows);
    return !error;
  } catch {
    return false;
  }
};
