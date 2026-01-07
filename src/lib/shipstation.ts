/**
 * ShipStation API Client
 *
 * Handles order creation and shipment tracking with ShipStation
 * API Documentation: https://www.shipstation.com/docs/api/
 */

const SHIPSTATION_API_BASE = "https://ssapi.shipstation.com"; // V1 API
const SHIPSTATION_V2_API_BASE = "https://api.shipstation.com"; // V2 API

// ShipStation API types
export type ShipStationOrder = {
  orderNumber: string;
  orderKey: string;
  orderDate: string;
  orderStatus: "awaiting_payment" | "awaiting_shipment" | "shipped" | "on_hold" | "cancelled";
  customerEmail: string;
  customerUsername?: string;
  billTo: ShipStationAddress;
  shipTo: ShipStationAddress;
  items: ShipStationOrderItem[];
  amountPaid: number;
  taxAmount: number;
  shippingAmount: number;
  customerNotes?: string;
  internalNotes?: string;
  gift?: boolean;
  giftMessage?: string;
};

export type ShipStationAddress = {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  street3?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  residential?: boolean;
};

export type ShipStationOrderItem = {
  sku: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
  shippingAmount?: number;
  weight?: {
    value: number;
    units: "ounces" | "pounds" | "grams";
  };
  productId?: string;
  fulfillmentSku?: string;
  adjustment?: boolean;
  upc?: string;
};

export type ShipStationShipment = {
  shipmentId: number;
  orderId: number;
  orderKey: string;
  orderNumber: string;
  trackingNumber: string;
  carrierCode: string;
  serviceCode: string;
  shipDate: string;
  createDate: string;
  shipmentCost: number;
  insuranceCost: number;
  trackingUrl?: string;
  voided: boolean;
  voidDate?: string;
};

export type ShipStationRate = {
  serviceName: string;
  serviceCode: string;
  shipmentCost: number;
  otherCost: number;
  carrierCode: string;
  deliveryDays?: number | null;
  deliveryDate?: string | null;
};

// V2 API Types
export type ShipStationV2Carrier = {
  carrier_id: string;
  carrier_code: string;
  name: string;
  account_number?: string;
  requires_funded_amount?: boolean;
  balance?: number;
};

export type ShipStationV2RateRequest = {
  shipment: {
    ship_from: {
      name: string;
      phone?: string;
      address_line1: string;
      city_locality: string;
      state_province: string;
      postal_code: string;
      country_code: string;
    };
    ship_to: {
      name: string;
      phone?: string;
      address_line1: string;
      city_locality: string;
      state_province: string;
      postal_code: string;
      country_code: string;
      address_residential_indicator?: "yes" | "no" | "unknown";
    };
    packages: Array<{
      weight: {
        value: number;
        unit: "ounce" | "pound" | "gram";
      };
      dimensions?: {
        length: number;
        width: number;
        height: number;
        unit: "inch";
      };
    }>;
  };
  rate_options: {
    carrier_ids: string[];
    service_codes?: string[];
  };
};

export type ShipStationV2RateItem = {
  rate_id: string;
  carrier_id: string;
  service_code: string;
  service_type: string;
  carrier_code: string;
  carrier_friendly_name: string;
  package_type: string;
  shipping_amount: {
    currency: string;
    amount: number;
  };
  confirmation_amount?: {
    currency: string;
    amount: number;
  };
  other_amount?: {
    currency: string;
    amount: number;
  };
  insurance_amount?: {
    currency: string;
    amount: number;
  };
  delivery_days?: number;
  estimated_delivery_date?: string;
};

export type ShipStationV2RateResponse = {
  rate_response: {
    status: "working" | "partial" | "completed" | "error";
    rates: ShipStationV2RateItem[];
    invalid_rates?: any[];
    errors?: any[];
  };
  shipment?: any;
};

/**
 * Get ShipStation V1 API credentials from environment
 */
function getCredentials() {
  const apiKey = process.env.SHIPSTATION_API_KEY;
  const apiSecret = process.env.SHIPSTATION_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("ShipStation API credentials not configured. Set SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET environment variables.");
  }

  return { apiKey, apiSecret };
}

/**
 * Get ShipStation V2 API key from environment
 * V2 API only requires a single API key (no secret)
 */
function getV2ApiKey(): string {
  const apiKey = process.env.SHIPSTATION_V2_API_KEY;

  if (!apiKey) {
    throw new Error("ShipStation V2 API key not configured. Set SHIPSTATION_V2_API_KEY environment variable.");
  }

  return apiKey;
}

/**
 * Create Basic Auth header for ShipStation V1 API
 */
function getAuthHeader(): string {
  const { apiKey, apiSecret } = getCredentials();
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  return `Basic ${auth}`;
}

/**
 * Make authenticated request to ShipStation V1 API (uses Basic Auth)
 */
async function shipstationRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${SHIPSTATION_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": getAuthHeader(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ShipStation] V1 API Error ${response.status}:`, errorText);
    throw new Error(`ShipStation API error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Make authenticated request to ShipStation V2 API (uses API-Key header)
 */
async function shipstationV2Request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getV2ApiKey();
  const url = `${SHIPSTATION_V2_API_BASE}${endpoint}`;

  console.log(`[ShipStation] V2 API Request: ${options.method || 'GET'} ${url}`);
  console.log(`[ShipStation] V2 API Key length: ${apiKey.length} chars`);

  const response = await fetch(url, {
    ...options,
    headers: {
      "API-Key": apiKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ShipStation] V2 API Error ${response.status}:`, errorText);
    console.error(`[ShipStation] V2 Request URL: ${url}`);
    console.error(`[ShipStation] V2 Request headers:`, {
      "API-Key": `${apiKey.substring(0, 8)}...`,
      "Content-Type": "application/json"
    });
    throw new Error(`ShipStation V2 API error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Create or update an order in ShipStation
 *
 * @param order ShipStation order data
 * @returns Created order response
 */
export async function createShipStationOrder(
  order: ShipStationOrder
): Promise<{ orderId: number; orderNumber: string; orderKey: string }> {
  console.log(`[ShipStation] Creating order ${order.orderNumber}...`);

  const response = await shipstationRequest<{ orderId: number; orderNumber: string; orderKey: string }>(
    "/orders/createorder",
    {
      method: "POST",
      body: JSON.stringify(order),
    }
  );

  console.log(`[ShipStation] Order ${order.orderNumber} created successfully (ID: ${response.orderId})`);
  return response;
}

/**
 * Get shipment details from ShipStation
 *
 * @param resourceUrl The resource URL from the webhook
 * @returns Array of shipments
 */
export async function getShipment(resourceUrl: string): Promise<ShipStationShipment[]> {
  console.log(`[ShipStation] Fetching shipment from ${resourceUrl}`);

  const response = await shipstationRequest<{ shipments: ShipStationShipment[] }>(
    resourceUrl.replace(SHIPSTATION_API_BASE, ""),
    {
      method: "GET",
    }
  );

  return response.shipments || [];
}

/**
 * Subscribe to a ShipStation webhook
 *
 * @param targetUrl Your webhook endpoint URL
 * @param event Event type (e.g., "SHIP_NOTIFY")
 * @param storeId Optional store ID to filter by
 * @returns Webhook subscription response
 */
export async function subscribeToWebhook(
  targetUrl: string,
  event: "SHIP_NOTIFY" | "ORDER_NOTIFY" | "ITEM_ORDER_NOTIFY" | "ITEM_SHIP_NOTIFY",
  storeId?: number
): Promise<{ id: string; event: string; target_url: string }> {
  console.log(`[ShipStation] Subscribing to ${event} webhook at ${targetUrl}`);

  const payload: Record<string, unknown> = {
    target_url: targetUrl,
    event,
    friendly_name: `Desert Candle Works - ${event}`,
  };

  if (storeId) {
    payload.store_id = storeId;
  }

  const response = await shipstationRequest<{ id: string; event: string; target_url: string }>(
    "/webhooks/subscribe",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  console.log(`[ShipStation] Webhook subscribed successfully (ID: ${response.id})`);
  return response;
}

/**
 * List all active webhooks
 */
export async function listWebhooks(): Promise<{ webhooks: Array<{ id: string; event: string; target_url: string }> }> {
  return shipstationRequest("/webhooks", { method: "GET" });
}

/**
 * Delete a webhook subscription
 */
export async function deleteWebhook(webhookId: string): Promise<void> {
  await shipstationRequest(`/webhooks/${webhookId}`, { method: "DELETE" });
  console.log(`[ShipStation] Webhook ${webhookId} deleted`);
}

/**
 * Package presets with dimensions based on weight
 * Better to provide rough dimensions than none
 */
type PackagePreset = {
  length: number;
  width: number;
  height: number;
};

function getPackagePreset(totalWeightOz: number): PackagePreset {
  // Small box: under 1.5 lbs (24 oz) - single candle
  if (totalWeightOz < 24) {
    return { length: 6, width: 6, height: 6 };
  }
  // Medium box: 1.5-3 lbs (24-48 oz) - 1-2 candles
  else if (totalWeightOz < 48) {
    return { length: 8, width: 8, height: 8 };
  }
  // Large box: over 3 lbs (48+ oz) - multiple candles
  else {
    return { length: 12, width: 10, height: 8 };
  }
}

/**
 * Allowed carrier codes for rate shopping
 * Only include carriers we actually use to avoid errors and speed up rate calls
 */
const ALLOWED_CARRIER_CODES = ["usps", "ups", "fedex"];

/**
 * Excluded service types - explicitly block these
 * Note: We filter by package_type first, then exclude specific services
 */
const EXCLUDED_SERVICE_PATTERNS = [
  /media.*mail/i,              // Media Mail not allowed for candles
];

/**
 * Check if a service/package combination is valid for candles
 */
function isValidCandleShippingOption(serviceType: string, packageType: string | null): boolean {
  // Rule 0: Reject null/undefined values
  if (!serviceType || !packageType) {
    return false;
  }

  const lowerService = serviceType.toLowerCase();
  const lowerPackage = packageType.toLowerCase();

  // Rule 1: Package type must be "package" (no envelopes)
  if (lowerPackage !== "package") {
    return false;
  }

  // Rule 2: Exclude Media Mail always
  if (EXCLUDED_SERVICE_PATTERNS.some(pattern => pattern.test(lowerService))) {
    return false;
  }

  // Rule 3: All other boxed services are allowed (including Express)
  return true;
}

/**
 * Get list of carriers from ShipStation V2 API
 * Filters to only USPS, UPS, and FedEx carriers
 */
export async function getCarriers(): Promise<ShipStationV2Carrier[]> {
  console.log("[ShipStation] Fetching carriers from V2 API");

  try {
    const response = await shipstationV2Request<{ carriers: ShipStationV2Carrier[] }>(
      "/v2/carriers"
    );

    // Filter to only allowed carriers (USPS, UPS, FedEx)
    const filteredCarriers = response.carriers.filter(c =>
      ALLOWED_CARRIER_CODES.includes(c.carrier_code.toLowerCase())
    );

    console.log(`[ShipStation] Found ${filteredCarriers.length} carriers (filtered from ${response.carriers.length} total)`);
    filteredCarriers.forEach(c => {
      console.log(`[ShipStation] Carrier: ${c.carrier_code} - ${c.carrier_id}`);
    });

    return filteredCarriers;
  } catch (error) {
    console.error("[ShipStation] Error fetching carriers:", error);
    throw error;
  }
}

/**
 * Get shipping rates from ShipStation V2 API
 * Uses POST /v2/rates endpoint with proper carrier IDs
 *
 * @param fromPostalCode Origin ZIP code
 * @param toPostalCode Destination ZIP code
 * @param totalWeightOz Total package weight in ounces
 * @param residential Whether destination is residential
 * @param toCity Optional destination city (for better rate accuracy)
 * @param toState Optional destination state (for better rate accuracy)
 * @returns Array of available shipping rates
 */
export async function getShippingRates(
  fromPostalCode: string,
  toPostalCode: string,
  totalWeightOz: number,
  residential: boolean = true,
  toCity?: string,
  toState?: string
): Promise<ShipStationRate[]> {
  console.log(`[ShipStation] Fetching V2 rates for ${toPostalCode}`);

  // Get package dimensions based on weight
  const packagePreset = getPackagePreset(totalWeightOz);

  // Fetch all carriers to get carrier IDs (required by V2 API)
  let carrierIds: string[];
  try {
    const carriers = await getCarriers();
    carrierIds = carriers.map(c => c.carrier_id);
    console.log(`[ShipStation] Using ${carrierIds.length} carriers for rate shopping`);
  } catch (error) {
    console.error(`[ShipStation] Failed to fetch carriers:`, error);
    throw new Error("Unable to fetch carrier list for rate shopping");
  }

  if (carrierIds.length === 0) {
    throw new Error("No carriers available for rate shopping");
  }

  // Get warehouse address from environment
  const fromAddress = {
    name: process.env.SHIPSTATION_FROM_NAME || "Desert Candle Works",
    phone: process.env.SHIPSTATION_FROM_PHONE || "0000000000",
    address_line1: process.env.SHIPSTATION_FROM_ADDRESS || "123 Main St",
    city_locality: process.env.SHIPSTATION_FROM_CITY || "Scottsdale",
    state_province: process.env.SHIPSTATION_FROM_STATE || "AZ",
    postal_code: fromPostalCode,
    country_code: "US"
  };

  // Build destination address (use provided city/state or placeholder values)
  const toAddress = {
    name: "Customer",
    phone: "0000000000",
    address_line1: "123 Main St",
    city_locality: toCity || "City",
    state_province: toState || "XX",
    postal_code: toPostalCode,
    country_code: "US",
    address_residential_indicator: (residential ? "yes" : "no") as "yes" | "no"
  };

  // Build V2 API request - correct structure per V2 docs
  const requestBody: ShipStationV2RateRequest = {
    shipment: {
      ship_from: fromAddress,
      ship_to: toAddress,
      packages: [
        {
          weight: {
            value: totalWeightOz,
            unit: "ounce"
          },
          dimensions: {
            ...packagePreset,
            unit: "inch"
          }
        }
      ]
    },
    rate_options: {
      carrier_ids: carrierIds
      // Don't filter by service_codes in request - filter on response instead
    }
  };

  try {
    const response = await shipstationV2Request<ShipStationV2RateResponse>(
      "/v2/rates",
      {
        method: "POST",
        body: JSON.stringify(requestBody),
      }
    );

    console.log(`[ShipStation] V2 Rate response status:`, response.rate_response.status);

    // Extract rates from rate_response.rates
    const allRates = response.rate_response.rates || [];
    console.log(`[ShipStation] Received ${allRates.length} total rates`);

    // Filter rates to only valid candle shipping options
    // Rule 1: Package type must be "package" (no envelopes)
    // Rule 2: Exclude Media Mail
    // Rule 3: Allow all other boxed services (including Express)
    const filteredRates = allRates.filter(r => {
      const isValid = isValidCandleShippingOption(r.service_type, r.package_type);

      if (!isValid) {
        console.log(`[ShipStation] Filtered out ${r.service_type} (package: ${r.package_type})`);
      }

      return isValid;
    });

    console.log(`[ShipStation] ${filteredRates.length} rates after filtering`);

    // Convert V2 response format to our internal format
    const rates: ShipStationRate[] = filteredRates.map(r => ({
      serviceName: r.service_type,
      serviceCode: r.service_code,
      carrierCode: r.carrier_code,
      shipmentCost: r.shipping_amount.amount,
      otherCost: (r.other_amount?.amount || 0) + (r.confirmation_amount?.amount || 0),
      deliveryDays: r.delivery_days ?? null,
      deliveryDate: r.estimated_delivery_date ?? null,
    }));

    console.log(`[ShipStation] Returning ${rates.length} valid rates`);

    // Validation: If zero rates returned, log diagnostic info
    if (rates.length === 0) {
      console.warn(`[ShipStation] Zero rates returned`);
      console.warn(`[ShipStation] Carrier IDs:`, carrierIds);
    }

    return rates;
  } catch (error) {
    console.error(`[ShipStation] Error fetching rates:`, error);
    throw error;
  }
}

/**
 * Packaging weight constant (ounces)
 * Includes: box, packing peanuts, hexawrap (3 layers), tape
 * This is added to all product weights for shipping calculation
 */
const PACKAGING_WEIGHT_OZ = 16;

/**
 * Helper function to calculate product weight for shipping
 * Returns total weight in ounces (candle + packaging)
 */
export function getProductWeight(
  product?: { weight?: { value: number; units: "ounces" | "pounds" } },
  sizeName?: string
): number {
  let candleWeight = 0;

  // If product has explicit weight, use it (this is candle only - jar + wax)
  if (product?.weight) {
    candleWeight = product.weight.units === "pounds"
      ? product.weight.value * 16
      : product.weight.value;
  } else {
    // Default candle weights by size (jar + wax only, in ounces)
    const defaultWeights: Record<string, number> = {
      "8 oz": 8,    // 8 oz candle (jar + wax)
      "12 oz": 14,  // 12 oz candle (jar + wax)
      "16 oz": 20,  // 16 oz candle (jar + wax)
    };

    // Default to 40 oz if no size match (protects seller by using higher weight)
    candleWeight = (sizeName && defaultWeights[sizeName]) ? defaultWeights[sizeName] : 40;
  }

  // Add packaging weight (box, packing peanuts, hexawrap, etc.)
  return candleWeight + PACKAGING_WEIGHT_OZ;
}

/**
 * Address validation response from ShipStation V1 API
 */
export type AddressValidationResponse = {
  name?: string;
  street1: string;
  street2?: string;
  street3?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  residential?: boolean;
};

/**
 * Validate an address using basic rules and format checks
 * This provides client-side-like validation on the server
 *
 * @param address Address to validate
 * @returns Validated address or throws error
 */
export async function validateAddress(address: {
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}): Promise<AddressValidationResponse> {
  console.log(`[ShipStation] Validating address: ${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`);

  const country = address.country || "US";

  // Basic validation rules
  if (!address.line1 || address.line1.trim().length < 3) {
    throw new Error("Street address is too short. Please enter a valid street address.");
  }

  if (!address.city || address.city.trim().length < 2) {
    throw new Error("City name is too short. Please enter a valid city.");
  }

  if (!address.state || address.state.trim().length < 2) {
    throw new Error("Please select a valid state.");
  }

  // US ZIP code validation
  if (country === "US") {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(address.postalCode.trim())) {
      throw new Error("Invalid ZIP code format. Please enter a 5-digit ZIP code (e.g., 85260 or 85260-1234).");
    }

    // US state codes validation (all valid 2-letter state codes)
    const validStates = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC', 'AS', 'GU', 'MP', 'PR', 'VI'
    ];

    if (!validStates.includes(address.state.toUpperCase())) {
      throw new Error(`Invalid state code: ${address.state}. Please enter a valid 2-letter US state code.`);
    }

    // ZIP code to state mapping validation
    // First digit of ZIP code determines the general region
    const zipFirstDigit = parseInt(address.postalCode.charAt(0));
    const zipPrefix = address.postalCode.substring(0, 3);
    const stateUpper = address.state.toUpperCase();

    // Comprehensive ZIP to state mapping
    const zipToStateRanges: Record<string, string[]> = {
      // Format: state code -> array of valid ZIP prefixes (first 3 digits)
      'MA': ['010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020', '021', '022', '023', '024', '025', '026', '027'],
      'RI': ['028', '029'],
      'NH': ['030', '031', '032', '033', '034', '035', '036', '037', '038'],
      'ME': ['039', '040', '041', '042', '043', '044', '045', '046', '047', '048', '049'],
      'VT': ['050', '051', '052', '053', '054', '056', '057', '058', '059'],
      'CT': ['060', '061', '062', '063', '064', '065', '066', '067', '068', '069'],
      'NJ': ['070', '071', '072', '073', '074', '075', '076', '077', '078', '079', '080', '081', '082', '083', '084', '085', '086', '087', '088', '089'],
      'NY': ['005', '006', '007', '009', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117', '118', '119', '120', '121', '122', '123', '124', '125', '126', '127', '128', '129', '130', '131', '132', '133', '134', '135', '136', '137', '138', '139', '140', '141', '142', '143', '144', '145', '146', '147', '148', '149'],
      'PA': ['150', '151', '152', '153', '154', '155', '156', '157', '158', '159', '160', '161', '162', '163', '164', '165', '166', '167', '168', '169', '170', '171', '172', '173', '174', '175', '176', '177', '178', '179', '180', '181', '182', '183', '184', '185', '186', '187', '188', '189', '190', '191', '192', '193', '194', '195', '196'],
      'DE': ['197', '198', '199'],
      'DC': ['200', '201', '202', '203', '204', '205'],
      'VA': ['201', '220', '221', '222', '223', '224', '225', '226', '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239', '240', '241', '242', '243', '244', '245', '246'],
      'WV': ['247', '248', '249', '250', '251', '252', '253', '254', '255', '256', '257', '258', '259', '260', '261', '262', '263', '264', '265', '266', '267', '268'],
      'NC': ['270', '271', '272', '273', '274', '275', '276', '277', '278', '279', '280', '281', '282', '283', '284', '285', '286', '287', '288', '289'],
      'SC': ['290', '291', '292', '293', '294', '295', '296', '297', '298', '299'],
      'GA': ['300', '301', '302', '303', '304', '305', '306', '307', '308', '309', '310', '311', '312', '313', '314', '315', '316', '317', '318', '319', '398', '399'],
      'FL': ['320', '321', '322', '323', '324', '325', '326', '327', '328', '329', '330', '331', '332', '333', '334', '335', '336', '337', '338', '339', '340', '341', '342', '344', '346', '347', '349'],
      'AL': ['350', '351', '352', '354', '355', '356', '357', '358', '359', '360', '361', '362', '363', '364', '365', '366', '367', '368', '369'],
      'TN': ['370', '371', '372', '373', '374', '375', '376', '377', '378', '379', '380', '381', '382', '383', '384', '385'],
      'MS': ['386', '387', '388', '389', '390', '391', '392', '393', '394', '395', '396', '397'],
      'KY': ['400', '401', '402', '403', '404', '405', '406', '407', '408', '409', '410', '411', '412', '413', '414', '415', '416', '417', '418', '420', '421', '422', '423', '424', '425', '426', '427'],
      'OH': ['430', '431', '432', '433', '434', '435', '436', '437', '438', '439', '440', '441', '442', '443', '444', '445', '446', '447', '448', '449', '450', '451', '452', '453', '454', '455', '456', '457', '458'],
      'IN': ['460', '461', '462', '463', '464', '465', '466', '467', '468', '469', '470', '471', '472', '473', '474', '475', '476', '477', '478', '479'],
      'MI': ['480', '481', '482', '483', '484', '485', '486', '487', '488', '489', '490', '491', '492', '493', '494', '495', '496', '497', '498', '499'],
      'IA': ['500', '501', '502', '503', '504', '505', '506', '507', '508', '510', '511', '512', '513', '514', '515', '516', '520', '521', '522', '523', '524', '525', '526', '527', '528'],
      'WI': ['530', '531', '532', '534', '535', '537', '538', '539', '540', '541', '542', '543', '544', '545', '546', '547', '548', '549'],
      'MN': ['550', '551', '553', '554', '555', '556', '557', '558', '559', '560', '561', '562', '563', '564', '565', '566', '567'],
      'SD': ['570', '571', '572', '573', '574', '575', '576', '577'],
      'ND': ['580', '581', '582', '583', '584', '585', '586', '588'],
      'MT': ['590', '591', '592', '593', '594', '595', '596', '597', '598', '599'],
      'IL': ['600', '601', '602', '603', '604', '605', '606', '607', '608', '609', '610', '611', '612', '613', '614', '615', '616', '617', '618', '619', '620', '622', '623', '624', '625', '626', '627', '628', '629'],
      'MO': ['630', '631', '633', '634', '635', '636', '637', '638', '639', '640', '641', '644', '645', '646', '647', '648', '649', '650', '651', '652', '653', '654', '655', '656', '657', '658'],
      'KS': ['660', '661', '662', '664', '665', '666', '667', '668', '669', '670', '671', '672', '673', '674', '675', '676', '677', '678', '679'],
      'NE': ['680', '681', '683', '684', '685', '686', '687', '688', '689', '690', '691', '692', '693'],
      'LA': ['700', '701', '703', '704', '705', '706', '707', '708', '710', '711', '712', '713', '714'],
      'AR': ['716', '717', '718', '719', '720', '721', '722', '723', '724', '725', '726', '727', '728', '729'],
      'OK': ['730', '731', '734', '735', '736', '737', '738', '739', '740', '741', '743', '744', '745', '746', '747', '748', '749'],
      'TX': ['750', '751', '752', '753', '754', '755', '756', '757', '758', '759', '760', '761', '762', '763', '764', '765', '766', '767', '768', '769', '770', '772', '773', '774', '775', '776', '777', '778', '779', '780', '781', '782', '783', '784', '785', '786', '787', '788', '789', '790', '791', '792', '793', '794', '795', '796', '797', '798', '799', '885'],
      'CO': ['800', '801', '802', '803', '804', '805', '806', '807', '808', '809', '810', '811', '812', '813', '814', '815', '816'],
      'WY': ['820', '821', '822', '823', '824', '825', '826', '827', '828', '829', '830', '831'],
      'ID': ['832', '833', '834', '835', '836', '837', '838'],
      'UT': ['840', '841', '842', '843', '844', '845', '846', '847'],
      'AZ': ['850', '851', '852', '853', '855', '856', '857', '859', '860', '863', '864', '865'],
      'NM': ['870', '871', '872', '873', '874', '875', '877', '878', '879', '880', '881', '882', '883', '884'],
      'NV': ['889', '890', '891', '893', '894', '895', '897', '898'],
      'CA': ['900', '901', '902', '903', '904', '905', '906', '907', '908', '910', '911', '912', '913', '914', '915', '916', '917', '918', '919', '920', '921', '922', '923', '924', '925', '926', '927', '928', '930', '931', '932', '933', '934', '935', '936', '937', '938', '939', '940', '941', '942', '943', '944', '945', '946', '947', '948', '949', '950', '951', '952', '953', '954', '955', '956', '957', '958', '959', '960', '961'],
      'HI': ['967', '968'],
      'OR': ['970', '971', '972', '973', '974', '975', '976', '977', '978', '979'],
      'WA': ['980', '981', '982', '983', '984', '985', '986', '988', '989', '990', '991', '992', '993', '994'],
      'AK': ['995', '996', '997', '998', '999'],
      // Territories
      'PR': ['006', '007', '008', '009'],
      'VI': ['008'],
      'GU': ['969'],
      'AS': ['967'],
      'MP': ['969'],
    };

    // Check if the ZIP prefix is valid for the given state
    const validPrefixesForState = zipToStateRanges[stateUpper];
    if (!validPrefixesForState || !validPrefixesForState.includes(zipPrefix)) {
      throw new Error(
        `ZIP code ${address.postalCode} does not match state ${stateUpper}. Please verify your address is correct.`
      );
    }
  }

  // Additional validation: Try to get shipping rates to verify address is real
  // If we can't get ANY rates (not even from one carrier), the address is likely invalid
  try {
    const rates = await getShippingRates(
      process.env.SHIPSTATION_FROM_POSTAL_CODE || "85260",
      address.postalCode,
      16, // 1 lb test weight
      true,
      address.city,
      address.state
    );

    if (rates.length === 0) {
      console.error(`[ShipStation] Address validation failed - no shipping rates available for ${address.postalCode}`);
      throw new Error(
        "Unable to calculate shipping to this address. Please verify your ZIP code, city, and state are correct."
      );
    }

    console.log(`[ShipStation] Address validation successful - ${rates.length} shipping rates available`);
  } catch (rateError) {
    console.error(`[ShipStation] Address validation failed during rate fetch:`, rateError);

    // If rate fetch fails, the address is invalid
    const errorMessage = rateError instanceof Error ? rateError.message : String(rateError);

    // Check if it's our custom error message
    if (errorMessage.includes("Unable to calculate shipping")) {
      throw rateError;
    }

    // Otherwise, provide a generic validation error
    throw new Error(
      "Unable to validate shipping address. Please check that your ZIP code matches your city and state."
    );
  }

  // Return validated address
  return {
    name: address.name,
    street1: address.line1,
    street2: address.line2,
    city: address.city,
    state: address.state.toUpperCase(),
    postalCode: address.postalCode,
    country: country,
    residential: true
  };
}

/**
 * Format an address for ShipStation
 */
export function formatAddressForShipStation(address: {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}): ShipStationAddress {
  return {
    name: address.name || "Unknown",
    street1: address.line1 || "",
    street2: address.line2 || "",
    city: address.city || "",
    state: address.state || "",
    postalCode: address.postalCode || "",
    country: address.country || "US",
    phone: address.phone || "",
    residential: true,  // Assume residential for candle orders
  };
}
