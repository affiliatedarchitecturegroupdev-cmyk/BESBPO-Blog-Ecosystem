export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        &copy; {new Date().getFullYear()} Besbpo Group. All articles originate at{' '}
        <a href="https://blog.besbpo.co.za">blog.besbpo.co.za</a>. ·{' '}
        <a href="/feed.xml">RSS</a>
      </p>
    </footer>
  );
}
