import { Globe, Phone, ShoppingBag, Truck, Utensils } from "lucide-react";
import { __ } from "../lib/i18n";

export type OrderType = "Dine In" | "Take Away" | "Delivery" | "Phone In" | "Aggregators";

export type OrderTypes= {
    label: string;
    value: OrderType;
    icon: React.ElementType;
}

// Function to get translated order types (called at runtime, not at module load)
export const getOrderTypes = (): OrderTypes[] => [
    {
        label: __("Dine In"),
        value: "Dine In",
        icon: Utensils
    },
    {
        label: __("Take Away"),
        value: "Take Away",
        icon: ShoppingBag
    },
    {
        label: __("Delivery"),
        value: "Delivery",
        icon: Truck
    },
    {
        label: __("Phone In"),
        value: "Phone In",
        icon: Phone
    },
    {
        label: __("Aggregators"),
        value: "Aggregators",
        icon: Globe
    }
];

// Legacy export for backward compatibility - uses non-translated labels
export const ORDER_TYPES: OrderTypes[] = [
    { label: "Dine In", value: "Dine In", icon: Utensils },
    { label: "Take Away", value: "Take Away", icon: ShoppingBag },
    { label: "Delivery", value: "Delivery", icon: Truck },
    { label: "Phone In", value: "Phone In", icon: Phone },
    { label: "Aggregators", value: "Aggregators", icon: Globe }
]

export const DINE_IN="Dine In"
export const DEFAULT_ORDER_TYPE="Take Away"
export const DEFAULT_PAYMENT_MODE="Cash"

export type OrderStatusType = "Draft" | "Unbilled" | "Recently Paid" | "Paid" | "Consolidated" | "Return";

// Base status types that are always available (runtime translated)
const getBaseOrderStatusTypes = () => [
    { label: __("Draft"), value: "Draft" },
    { label: __("Unbilled"), value: "Unbilled" }
];

// Recently Paid status that appears when paid_limit > 0 (runtime translated)
const getRecentlyPaidStatusType = () => [
    { label: __("Recently Paid"), value: "Recently Paid" }
];

// Extended status types (runtime translated)
const getExtendedOrderStatusTypes = () => [
    { label: __("Paid"), value: "Paid" },
    { label: __("Consolidated"), value: "Consolidated" },
    { label: __("Return"), value: "Return" }
];

// Legacy exports (non-translated)
export const BASE_ORDER_STATUS_TYPES = [
    { label: "Draft", value: "Draft" },
    { label: "Unbilled", value: "Unbilled" }
];

export const RECENTLY_PAID_STATUS_TYPE = [
    { label: "Recently Paid", value: "Recently Paid" }
];

export const EXTENDED_ORDER_STATUS_TYPES = [
    { label: "Paid", value: "Paid" },
    { label: "Consolidated", value: "Consolidated" },
    { label: "Return", value: "Return" }
];

// Function to get order status types based on POS profile settings (with translations)
export const getOrderStatusTypes = (viewAllStatus?: number, paidLimit?: number) => {
    let statusTypes = [...getBaseOrderStatusTypes()];

    // Add Recently Paid if paid_limit > 0
    if (paidLimit && paidLimit > 0) {
        statusTypes.push(...getRecentlyPaidStatusType());
    }

    // Add extended statuses if view_all_status is enabled
    if (viewAllStatus === 1) {
        statusTypes.push(...getExtendedOrderStatusTypes());
    }

    return statusTypes;
};

// Legacy export for backward compatibility
export const ORDER_STATUS_TYPES = BASE_ORDER_STATUS_TYPES;