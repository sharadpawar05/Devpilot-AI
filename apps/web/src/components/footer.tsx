export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container flex items-center justify-between py-4 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} DevPilot. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="/privacy" className="hover:text-foreground">
            Privacy
          </a>
          <a href="/terms" className="hover:text-foreground">
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}
