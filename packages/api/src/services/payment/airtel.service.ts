import axios from "axios";

interface PaymentParams {
  amount: number;
  phone: string;
  reference: string;
}

interface PaymentService {
  initiatePayment(params: PaymentParams): Promise<string>;
  initiateTransfer(params: PaymentParams): Promise<string>;
}

async function getAccessToken(): Promise<string> {
  const response = await axios.post(
    `${process.env.AIRTEL_MONEY_BASE_URL}/auth/oauth2/token`,
    {
      client_id: process.env.AIRTEL_MONEY_CLIENT_ID,
      client_secret: process.env.AIRTEL_MONEY_CLIENT_SECRET,
      grant_type: "client_credentials",
    },
    { headers: { "Content-Type": "application/json" } },
  );
  return response.data.access_token;
}

export const airtelService: PaymentService = {
  async initiatePayment({ amount, phone, reference }) {
    const token = await getAccessToken();
    const response = await axios.post(
      `${process.env.AIRTEL_MONEY_BASE_URL}/merchant/v2/payments`,
      {
        reference,
        subscriber: { country: "TD", currency: "XAF", msisdn: phone },
        transaction: { amount, country: "TD", currency: "XAF", id: reference },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Country": "TD",
          "X-Currency": "XAF",
          "Content-Type": "application/json",
        },
      },
    );
    return response.data.data?.transaction?.id ?? reference;
  },

  async initiateTransfer({ amount, phone, reference }) {
    const token = await getAccessToken();
    const response = await axios.post(
      `${process.env.AIRTEL_MONEY_BASE_URL}/standard/v1/disbursements`,
      {
        payee: { msisdn: phone },
        reference,
        pin: process.env.AIRTEL_MONEY_PIN,
        transaction: { amount, id: reference, type: "B2C" },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Country": "TD",
          "X-Currency": "XAF",
          "Content-Type": "application/json",
        },
      },
    );
    return response.data.data?.transaction?.id ?? reference;
  },
};
