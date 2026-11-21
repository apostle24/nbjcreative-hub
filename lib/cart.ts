"use client";

export type CartEntry = { productId: string; quantity: number };

const CART_KEY = "nbjcreative_cart_v1";

export function readCart(): CartEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is CartEntry =>
      typeof item?.productId === "string" &&
      Number.isInteger(item?.quantity) &&
      item.quantity > 0
    );
  } catch {
    return [];
  }
}

function saveCart(items: CartEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("nbj-cart-updated"));
}

export function addToCart(productId: string) {
  const items = readCart();
  const existing = items.find(item => item.productId === productId);
  if (existing) existing.quantity += 1;
  else items.push({ productId, quantity: 1 });
  saveCart(items);
}

export function updateCartQuantity(productId: string, quantity: number) {
  const items = readCart()
    .map(item => item.productId === productId ? { ...item, quantity } : item)
    .filter(item => item.quantity > 0);
  saveCart(items);
}

export function removeFromCart(productId: string) {
  saveCart(readCart().filter(item => item.productId !== productId));
}

export function clearCart() {
  saveCart([]);
}
