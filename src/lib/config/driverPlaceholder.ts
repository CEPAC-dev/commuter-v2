// Static placeholder driver shown on ongoing trips until real driver
// assignment / matching is implemented. No DB link yet.

export interface PlaceholderDriver {
  name: string;
  phone: string;
  /** Optional image URL; when absent an initials avatar is rendered. */
  profilePic: string | null;
  carBrand: string;
  carModel: string;
  modelYear: number;
  plate: string;
}

export const PLACEHOLDER_DRIVER: PlaceholderDriver = {
  name: "",
  phone: "",
  profilePic: null,
  carBrand: "",
  carModel: "",
  modelYear: 0,
  plate: "",
};
