export type Product = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  price: number;
  pricePending?: number;
  quantity: number;
  size: string;
  category: string;
  image: string;
  titleEn?: string;
  subtitleEn?: string;
  descriptionEn?: string;
  isDemo?: number;
  active?: number;
  archived?: number;
};
export const demoProducts: Product[] = [
  ...["S", "M", "L", "XL"].map((size, i) => ({
    id: i + 1,
    slug: "original-tee",
    title: "Футболка Original",
    titleEn: "Original T-shirt",
    subtitleEn: "Black / relaxed fit",
    descriptionEn:
      "A black Fuck Famous Group print T-shirt. A relaxed silhouette, stripped back to what matters.",
    isDemo: 1,
    subtitle: "Чорний / вільний крій",
    description:
      "Чорна футболка з принтом Fuck Famous Group. Вільний силует, мінімум зайвого — тільки своє.",
    price: 1200,
    quantity: 12,
    size,
    category: "tshirt",
    image: "/images/tshirt.png",
  })),
  ...["S", "M", "L", "XL"].map((size, i) => ({
    id: i + 5,
    slug: "ffg-hoodie",
    title: "Худі FFG",
    titleEn: "FFG Hoodie",
    subtitleEn: "Black / relaxed fit",
    descriptionEn:
      "An oversized black FFG hoodie. Everyday merch for those on the same wavelength.",
    isDemo: 1,
    subtitle: "Чорний / вільний крій",
    description:
      "Об’ємне чорне худі з принтом FFG. Концепт щоденного мерчу для тих, хто з нами на одній хвилі.",
    price: 2400,
    quantity: 8,
    size,
    category: "hoodie",
    image: "/images/hoodie.png",
  })),
  {
    id: 9,
    slug: "ffg-cap",
    title: "Кепка FFG",
    titleEn: "FFG Cap",
    subtitleEn: "Black / adjustable fit",
    descriptionEn:
      "A black cap with FFG embroidery and an adjustable strap. A simple everyday detail.",
    isDemo: 1,
    subtitle: "Чорний / універсальний розмір",
    description:
      "Чорна кепка з вишивкою FFG та регульованою застібкою. Лаконічний акцент на кожен день.",
    price: 750,
    quantity: 20,
    size: "ONE SIZE",
    category: "accessory",
    image: "/images/cap.png",
  },
];
