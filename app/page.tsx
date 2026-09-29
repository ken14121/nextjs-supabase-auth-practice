import { Globe, LogIn, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Globe className="size-6" />
            旅の記録アプリ（準備中）
          </CardTitle>
          <CardDescription className="[word-break:auto-phrase]">
            今までの旅行を振り返って、<br />友達と行った県や国を比べられるアプリです。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPinned className="size-4" />
            Google マップの履歴から、行った都道府県・国を集計します。
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" disabled>
            <LogIn />
            Google でログイン（Step 3 で作ります）
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}