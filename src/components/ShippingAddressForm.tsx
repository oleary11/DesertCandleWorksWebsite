import { US_STATES } from "@/lib/usStates";

type ShippingAddressFormProps = {
  address: {
    name: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  onChange: (field: string, value: string) => void;
  onGetRates: () => void;
  fetchingRates: boolean;
  disabled?: boolean;
};

export default function ShippingAddressForm({
  address,
  onChange,
  onGetRates,
  fetchingRates,
  disabled = false
}: ShippingAddressFormProps) {
  const isFormComplete = address.name && address.line1 && address.city && address.state && address.postalCode.length === 5;

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Full Name"
        value={address.name}
        onChange={(e) => onChange('name', e.target.value)}
        className="input text-sm w-full"
        disabled={disabled}
      />

      <input
        type="text"
        placeholder="Address Line 1"
        value={address.line1}
        onChange={(e) => onChange('line1', e.target.value)}
        className="input text-sm w-full"
        disabled={disabled}
      />

      <input
        type="text"
        placeholder="Address Line 2 (Optional)"
        value={address.line2}
        onChange={(e) => onChange('line2', e.target.value)}
        className="input text-sm w-full"
        disabled={disabled}
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="City"
          value={address.city}
          onChange={(e) => onChange('city', e.target.value)}
          className="input text-sm"
          disabled={disabled}
        />

        <select
          value={address.state}
          onChange={(e) => onChange('state', e.target.value)}
          className="input text-sm"
          disabled={disabled}
        >
          <option value="">State</option>
          {US_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {state.code}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="ZIP Code"
          value={address.postalCode}
          onChange={(e) => onChange('postalCode', e.target.value.replace(/\D/g, '').slice(0, 5))}
          onKeyDown={(e) => e.key === "Enter" && isFormComplete && onGetRates()}
          className="input text-sm flex-1"
          maxLength={5}
          disabled={disabled}
        />

        <button
          onClick={onGetRates}
          disabled={fetchingRates || !isFormComplete}
          className="btn btn-sm px-4 disabled:opacity-50"
        >
          {fetchingRates ? "Loading..." : "Get Rates"}
        </button>
      </div>
    </div>
  );
}
