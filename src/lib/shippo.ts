/**
 * Shippo shipping provider.
 *
 * Uses Shippo for address validation and rate shopping while keeping the
 * application's existing internal shipping-rate shape.
 */

const SHIPPO_API_BASE = "https://api.goshippo.com";

export type ShippingRate = {
  serviceName: string;
  serviceCode: string;
  carrierCode: string;
  shipmentCost: number;
  otherCost: number;
  deliveryDays: number | null;
  deliveryDate: string | null;
};

export type AddressValidationResponse = {
  name?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  residential?: boolean;
};

type ShippoAddress = {
  name?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_residential?: boolean;
  validation_results?: {
    is_valid: boolean;
    messages?: Array<{ text?: string }>;
  };
};

type ShippoRate = {
  amount: string;
  currency: string;
  provider: string;
  servicelevel: {
    name: string;
    token: string;
  };
  estimated_days?: number | null;
  duration_terms?: string | null;
};

type ShippoShipment = {
  rates?: ShippoRate[];
  messages?: Array<{ text?: string; code?: string }>;
};

export type ShippoOrderInput = {
  orderNumber: string;
  stripeSessionId: string;
  placedAt: string;
  email: string;
  phone?: string;
  toAddress: {
    name?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  lineItems: Array<{
    sku: string;
    title: string;
    variantTitle?: string;
    quantity: number;
    totalPriceCents: number;
    weightOz: number;
  }>;
  subtotalCents: number;
  totalCents: number;
  taxCents: number;
  shippingCents: number;
  shippingMethod: string;
};

type ShippoOrderResponse = {
  object_id: string;
  order_number: string;
  notes?: string;
};

type ShippoOrderListResponse = {
  results?: ShippoOrderResponse[];
};

export type ShippoTransaction = {
  object_id: string;
  status?: string;
  order?: string | { object_id?: string };
  tracking_number?: string;
  tracking_url_provider?: string;
  rate?: string | {
    provider?: string;
    servicelevel?: { token?: string; name?: string };
  };
};

export type ShippoDashboardOrder = ShippoOrderResponse & {
  order_status?: string;
};

export type ShippoRateDetails = {
  provider?: string;
  servicelevel?: { token?: string; name?: string };
};

function getShippoToken(): string {
  const token = process.env.SHIPPO_API_TOKEN || process.env.SHIPPO_TEST_TOKEN;
  if (!token) {
    throw new Error(
      "Shippo is not configured. Set SHIPPO_API_TOKEN (or SHIPPO_TEST_TOKEN while testing)."
    );
  }
  return token;
}

async function shippoRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${SHIPPO_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `ShippoToken ${getShippoToken()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });

  const responseText = await response.text();
  let responseBody: unknown;
  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = responseText;
  }

  if (!response.ok) {
    const detail =
      typeof responseBody === "object" && responseBody !== null
        ? JSON.stringify(responseBody)
        : String(responseBody);
    throw new Error(`Shippo API error ${response.status}: ${detail}`);
  }

  return responseBody as T;
}

function getPackagePreset(totalWeightOz: number) {
  if (totalWeightOz < 24) return { length: "6", width: "6", height: "6" };
  if (totalWeightOz < 48) return { length: "8", width: "8", height: "8" };
  return { length: "12", width: "10", height: "8" };
}

export async function validateAddress(address: {
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}): Promise<AddressValidationResponse> {
  const country = (address.country || "US").toUpperCase();

  if (!address.line1 || address.line1.trim().length < 3) {
    throw new Error("Street address is too short. Please enter a valid street address.");
  }
  if (!address.city || address.city.trim().length < 2) {
    throw new Error("City name is too short. Please enter a valid city.");
  }
  if (!address.state || address.state.trim().length < 2) {
    throw new Error("Please select a valid state.");
  }
  if (country === "US" && !/^\d{5}(-\d{4})?$/.test(address.postalCode.trim())) {
    throw new Error("Invalid ZIP code format. Please enter a valid ZIP code.");
  }

  const validated = await shippoRequest<ShippoAddress>("/addresses/", {
    method: "POST",
    body: JSON.stringify({
      name: address.name || "Customer",
      street1: address.line1,
      street2: address.line2 || "",
      city: address.city,
      state: address.state,
      zip: address.postalCode,
      country,
      validate: true,
    }),
  });

  if (validated.validation_results && !validated.validation_results.is_valid) {
    const message = validated.validation_results.messages
      ?.map(item => item.text)
      .filter(Boolean)
      .join(" ");
    throw new Error(message || "Shippo could not validate this shipping address.");
  }

  return {
    name: validated.name || address.name,
    street1: validated.street1 || address.line1,
    street2: validated.street2 || address.line2,
    city: validated.city || address.city,
    state: (validated.state || address.state).toUpperCase(),
    postalCode: validated.zip || address.postalCode,
    country: validated.country || country,
    residential: validated.is_residential,
  };
}

export async function getShippingRates(
  fromPostalCode: string,
  toPostalCode: string,
  totalWeightOz: number,
  residential = true,
  toCity?: string,
  toState?: string,
  toLine1?: string,
  toLine2?: string,
  toCountry = "US"
): Promise<ShippingRate[]> {
  const dimensions = getPackagePreset(totalWeightOz);
  const shipment = await shippoRequest<ShippoShipment>("/shipments/", {
    method: "POST",
    body: JSON.stringify({
      address_from: {
        name: process.env.SHIPPO_FROM_NAME || process.env.SHIPSTATION_FROM_NAME || "Desert Candle Works",
        street1: process.env.SHIPPO_FROM_ADDRESS || process.env.SHIPSTATION_FROM_ADDRESS,
        city: process.env.SHIPPO_FROM_CITY || process.env.SHIPSTATION_FROM_CITY || "Scottsdale",
        state: process.env.SHIPPO_FROM_STATE || process.env.SHIPSTATION_FROM_STATE || "AZ",
        zip: fromPostalCode,
        country: "US",
        phone: process.env.SHIPPO_FROM_PHONE || process.env.SHIPSTATION_FROM_PHONE,
        email:
          process.env.SHIPPO_FROM_EMAIL ||
          process.env.SHIPSTATION_FROM_EMAIL ||
          "contact@desertcandleworks.com",
      },
      address_to: {
        name: "Customer",
        street1: toLine1 || "Address unavailable",
        street2: toLine2 || "",
        city: toCity,
        state: toState,
        zip: toPostalCode,
        country: toCountry,
        is_residential: residential,
      },
      parcels: [{
        ...dimensions,
        distance_unit: "in",
        weight: String(Math.max(totalWeightOz, 1)),
        mass_unit: "oz",
      }],
      async: false,
    }),
  });

  return (shipment.rates || [])
    .filter(rate => {
      const name = rate.servicelevel?.name || "";
      return rate.currency === "USD" && !/media\s*mail/i.test(name);
    })
    .map(rate => ({
      serviceName: `${rate.provider} ${rate.servicelevel.name}`,
      serviceCode: rate.servicelevel.token,
      carrierCode: rate.provider.toLowerCase(),
      shipmentCost: Number(rate.amount),
      otherCost: 0,
      deliveryDays: rate.estimated_days ?? null,
      deliveryDate: null,
    }))
    .filter(rate => Number.isFinite(rate.shipmentCost));
}

/**
 * Push a paid website order to Shippo so it appears in the Orders dashboard.
 * This does not purchase postage or create a label.
 */
export async function createShippoOrder(
  order: ShippoOrderInput
): Promise<ShippoOrderResponse> {
  const syncReference = `Stripe session: ${order.stripeSessionId}`;

  // Stripe can retry webhooks. Look for the stable Stripe session reference
  // before creating anything so a retry cannot duplicate a Shippo order.
  const recentOrders = await shippoRequest<ShippoOrderListResponse>(
    "/orders/?results=100&order_status=PAID",
    { method: "GET" }
  );
  const existing = recentOrders.results?.find(
    candidate => candidate.notes?.includes(syncReference)
  );
  if (existing) {
    return existing;
  }

  const totalWeightOz = order.lineItems.reduce(
    (sum, item) => sum + item.weightOz * item.quantity,
    PACKAGING_WEIGHT_OZ
  );

  return shippoRequest<ShippoOrderResponse>("/orders/", {
    method: "POST",
    body: JSON.stringify({
      placed_at: order.placedAt,
      order_number: order.orderNumber,
      order_status: "PAID",
      to_address: {
        name: order.toAddress.name || "Customer",
        street1: order.toAddress.line1,
        street2: order.toAddress.line2 || "",
        city: order.toAddress.city,
        state: order.toAddress.state,
        zip: order.toAddress.postalCode,
        country: order.toAddress.country || "US",
        email: order.email,
        phone: order.phone || "",
      },
      from_address: {
        name: process.env.SHIPPO_FROM_NAME || process.env.SHIPSTATION_FROM_NAME || "Desert Candle Works",
        street1: process.env.SHIPPO_FROM_ADDRESS || process.env.SHIPSTATION_FROM_ADDRESS,
        city: process.env.SHIPPO_FROM_CITY || process.env.SHIPSTATION_FROM_CITY || "Scottsdale",
        state: process.env.SHIPPO_FROM_STATE || process.env.SHIPSTATION_FROM_STATE || "AZ",
        zip: process.env.SHIPPO_FROM_POSTAL_CODE || process.env.SHIPSTATION_FROM_POSTAL_CODE || "85260",
        country: "US",
        phone: process.env.SHIPPO_FROM_PHONE || process.env.SHIPSTATION_FROM_PHONE || "",
        email:
          process.env.SHIPPO_FROM_EMAIL ||
          process.env.SHIPSTATION_FROM_EMAIL ||
          "contact@desertcandleworks.com",
      },
      line_items: order.lineItems.map(item => ({
        sku: item.sku,
        title: item.title,
        variant_title: item.variantTitle || "",
        quantity: item.quantity,
        total_price: (item.totalPriceCents / 100).toFixed(2),
        currency: "USD",
        weight: String(item.weightOz),
        weight_unit: "oz",
        manufacture_country: "US",
      })),
      shipping_cost: (order.shippingCents / 100).toFixed(2),
      shipping_cost_currency: "USD",
      shipping_method: order.shippingMethod,
      subtotal_price: (order.subtotalCents / 100).toFixed(2),
      total_price: (order.totalCents / 100).toFixed(2),
      total_tax: (order.taxCents / 100).toFixed(2),
      currency: "USD",
      weight: String(totalWeightOz),
      weight_unit: "oz",
      notes: syncReference,
    }),
  });
}

export async function getShippoTransaction(
  transactionId: string
): Promise<ShippoTransaction> {
  return shippoRequest<ShippoTransaction>(`/transactions/${encodeURIComponent(transactionId)}/`);
}

export async function getShippoDashboardOrder(
  orderId: string
): Promise<ShippoDashboardOrder> {
  return shippoRequest<ShippoDashboardOrder>(`/orders/${encodeURIComponent(orderId)}/`);
}

export async function getShippoRate(rateId: string): Promise<ShippoRateDetails> {
  return shippoRequest<ShippoRateDetails>(`/rates/${encodeURIComponent(rateId)}/`);
}

export const PACKAGING_WEIGHT_OZ = 16;

export function getProductWeight(
  product?: { weight?: { value: number; units: "ounces" | "pounds" } },
  sizeName?: string
): number {
  if (product?.weight) {
    return product.weight.units === "pounds"
      ? product.weight.value * 16
      : product.weight.value;
  }

  const defaultWeights: Record<string, number> = {
    "8 oz": 8,
    "12 oz": 14,
    "16 oz": 20,
  };
  return sizeName && defaultWeights[sizeName] ? defaultWeights[sizeName] : 40;
}
