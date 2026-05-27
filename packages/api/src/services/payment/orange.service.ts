import axios from "axios";

interface PaymentParams {
  amount: number;
  phone: string;
  reference: string;
}

export const orangeService = {
  async initiatePayment({ amount, phone, reference }: PaymentParams): Promise<string> {
    const response = await axios.post(
      `${process.env.ORANGE_MONEY_BASE_URL}/webpayment`,
      {
        merchant_key: process.env.ORANGE_MONEY_MERCHANT_KEY,
        currency: "XAF",
        order_id: reference,
        amount,
        return_url: `${process.env.APP_BASE_URL}/payment/callback`,
        cancel_url: `${process.env.APP_BASE_URL}/payment/cancel`,
        notif_url: `${process.env.APP_BASE_URL}/api/webhooks/orange-money`,
        lang: "fr",
        reference,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.ORANGE_MONEY_SECRET}`,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data.pay_token ?? reference;
  },

  async initiateTransfer({ amount, phone, reference }: PaymentParams): Promise<string> {
    // Orange Money Chad B2C — adapter selon l'API disponible
    const response = await axios.post(
      `${process.env.ORANGE_MONEY_BASE_URL}/transfer`,
      { amount, msisdn: phone, reference, currency: "XAF" },
      {
        headers: {
          Authorization: `Bearer ${process.env.ORANGE_MONEY_SECRET}`,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data.transaction_id ?? reference;
  },
};
