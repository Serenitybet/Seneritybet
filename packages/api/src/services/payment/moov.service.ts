import axios from "axios";

interface PaymentParams {
  amount: number;
  phone: string;
  reference: string;
}

export const moovService = {
  async initiatePayment({ amount, phone, reference }: PaymentParams): Promise<string> {
    const response = await axios.post(
      `${process.env.MOOV_MONEY_BASE_URL}/payment/collect`,
      {
        merchantId: process.env.MOOV_MONEY_MERCHANT_ID,
        amount,
        msisdn: phone,
        orderId: reference,
        currency: "XAF",
        notificationUrl: `${process.env.APP_BASE_URL}/api/webhooks/moov-money`,
      },
      {
        headers: {
          "X-API-Key": process.env.MOOV_MONEY_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data.transactionId ?? reference;
  },

  async initiateTransfer({ amount, phone, reference }: PaymentParams): Promise<string> {
    const response = await axios.post(
      `${process.env.MOOV_MONEY_BASE_URL}/payment/disburse`,
      {
        merchantId: process.env.MOOV_MONEY_MERCHANT_ID,
        amount,
        msisdn: phone,
        reference,
        currency: "XAF",
      },
      {
        headers: {
          "X-API-Key": process.env.MOOV_MONEY_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data.transactionId ?? reference;
  },
};
