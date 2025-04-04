import Button from "@repo/ui/button";
import { ProductCard } from "@repo/ui/productCard";
import SkeletonLoader from "@repo/ui/skeleton";
import { Text } from "@repo/ui/typography";
import { useAtom } from "jotai";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	isLoadingAtom,
	quantityOfProducts,
	searchQueryAtom,
	searchResultsAtom,
} from "~/atoms/productAtom";
import { api } from "~/trpc/react";
import type { NftMetadata, Product } from "./types";

const MARKET_FEE_BPS = 5000; // 50%

interface ProductCatalogProps {
	isConnected?: boolean;
	onConnect?: () => void;
}

export default function ProductCatalog({
	isConnected,
	onConnect,
}: ProductCatalogProps) {
	const { t } = useTranslation();
	const [products, setProducts] = useState<Product[]>([]);
	const [results, setSearchResults] = useAtom(searchResultsAtom);
	const [isLoadingResults, setIsLoading] = useAtom(isLoadingAtom);
	const [quantity, setQuantityProducts] = useAtom(quantityOfProducts);
	const [query, setQuery] = useAtom(searchQueryAtom);
	const router = useRouter();
	const [addingToCart, setAddingToCart] = useState<number | null>(null);

	const { refetch: refetchCart } = api.cart.getUserCart.useQuery();
	const { mutate: addToCart } = api.cart.addToCart.useMutation({
		onSuccess: () => {
			void refetchCart();
		},
	});

	const calculateTotalPrice = (price: number): number => {
		const fee = (price * MARKET_FEE_BPS) / 10000;
		return price + fee;
	};

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
		api.product.getProducts.useInfiniteQuery(
			{
				limit: 3,
				includeHidden: false,
			},
			{
				getNextPageParam: (lastPage) => lastPage.nextCursor,
			},
		);

	useEffect(() => {
		if (data) {
			const allProducts = data.pages.flatMap(
				(page) =>
					page.products
						.filter((product) => product.hidden !== true)
						.map((product) => ({
							...product,
							process: "Natural",
							stock: product.stock ?? 0,
						})) as Product[],
			);
			setProducts(allProducts);
		}
	}, [data]);

	const handleScroll = useCallback(() => {
		if (
			window.innerHeight + window.scrollY >= document.body.offsetHeight - 100 &&
			!isFetchingNextPage &&
			hasNextPage
		) {
			void fetchNextPage();
		}
	}, [isFetchingNextPage, hasNextPage, fetchNextPage]);

	useEffect(() => {
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, [handleScroll]);

	const accessProductDetails = (productId: number) => {
		router.push(`/product/${productId}`);
	};

	const renderProduct = (product: Product) => {
		if (product.hidden === true) {
			return null;
		}

		let metadata: NftMetadata | null = null;

		if (typeof product.nftMetadata === "string") {
			try {
				metadata = JSON.parse(product.nftMetadata) as NftMetadata;
			} catch {
				metadata = null;
			}
		} else {
			metadata = product.nftMetadata as NftMetadata;
		}

		const imageUrl = metadata?.imageUrl
			? metadata.imageUrl.startsWith("Qm")
				? `${process.env.NEXT_PUBLIC_GATEWAY_URL}/ipfs/${metadata.imageUrl}`
				: metadata.imageUrl
			: "/images/cafe1.webp";

		const handleAddToCart = () => {
			if (!isConnected && onConnect) {
				onConnect();
				return;
			}

			setAddingToCart(product.id);
			addToCart(
				{
					productId: product.id,
					quantity: 1,
				},
				{
					onSuccess: () => {
						setAddingToCart(null);
					},
					onError: () => {
						setAddingToCart(null);
					},
				},
			);
		};

		const totalPrice = calculateTotalPrice(product.price);

		return (
			<ProductCard
				key={product.id}
				image={imageUrl}
				region={metadata?.region ?? ""}
				farmName={metadata?.farmName ?? ""}
				variety={t(product.name)}
				price={totalPrice}
				stock={product.stock}
				badgeText={t(`strength.${metadata?.strength?.toLowerCase()}`)}
				onClick={() => accessProductDetails(product.id)}
				onAddToCart={handleAddToCart}
				isConnected={isConnected}
				isAddingToShoppingCart={addingToCart === product.id}
			/>
		);
	};

	const clearSearch = () => {
		setQuantityProducts(0);
		setSearchResults([]);
		setIsLoading(false);
		setQuery("");
	};

	return (
		<div className="flex flex-col items-center gap-6 w-full">
			{isLoadingResults ? (
				<div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
					<SkeletonLoader width="w-full" height="h-[30rem]" />
					<SkeletonLoader
						width="w-full"
						height="h-[30rem]"
						className="hidden md:block"
					/>
					<SkeletonLoader
						width="w-full"
						height="h-[30rem]"
						className="hidden lg:block"
					/>
				</div>
			) : (
				<>
					{results.length > 0 ? (
						<div className="w-full">
							<div className="flex justify-between items-center mb-6">
								<div className="text-lg font-medium">
									{t("products_found", { count: quantity })}
								</div>
								<button
									type="button"
									className="text-blue-600 hover:text-blue-800 transition-colors font-medium"
									onClick={() => clearSearch()}
								>
									{t("clear_search")}
								</button>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full">
								{results
									.filter((product) => product.hidden !== true)
									.map((product) => (
										<div key={product.id} className="w-full">
											{renderProduct({
												...product,
												stock: product.stock ?? 0,
											})}
										</div>
									))}
							</div>
						</div>
					) : query ? (
						<div className="w-full py-12">
							<div className="max-w-md mx-auto text-center">
								<Image
									src="/images/NoResultsImage.png"
									width={300}
									height={300}
									alt={t("no_results_image_alt")}
									className="w-full h-auto mb-6"
									priority
								/>
								<Text className="text-lg text-gray-600 mb-6">
									{t("no_results_message")}
								</Text>
								<Button
									variant="primary"
									size="sm"
									onClick={() => clearSearch()}
									className="px-8 py-2"
								>
									{t("clear_search")}
								</Button>
							</div>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full">
							{products.map((product) => (
								<div key={product.id} className="w-full">
									{renderProduct(product)}
								</div>
							))}
						</div>
					)}

					{isFetchingNextPage && (
						<div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mt-6">
							<SkeletonLoader width="w-full" height="h-[30rem]" />
							<SkeletonLoader
								width="w-full"
								height="h-[30rem]"
								className="hidden md:block"
							/>
							<SkeletonLoader
								width="w-full"
								height="h-[30rem]"
								className="hidden lg:block"
							/>
						</div>
					)}
				</>
			)}
		</div>
	);
}
