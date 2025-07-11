import Link from "next/link";
import { ChefHat } from "lucide-react";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5">
          <Link href="/" className="flex gap-2 items-center">
            <ChefHat className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Recipe and Me</span>
          </Link>
        </div>
      </nav>
      
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-20">
        <div className="max-w-2xl text-center space-y-6">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="text-lg text-muted-foreground">
            Your privacy is important to us. Recipe and Me is committed to protecting your personal information 
            and your family recipes. We never share your data with third parties.
          </p>
          <Link href="/" className="text-primary hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}