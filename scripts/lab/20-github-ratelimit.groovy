// Anonymous GitHub API access: the default "evenly distribute" limiter sleeps for minutes, so turn the throttle off (the webhook keeps API use tiny).
import org.jenkinsci.plugins.github_branch_source.*
def c = GitHubConfiguration.get()
c.setApiRateLimitChecker(ApiRateLimitChecker.NoThrottle)
c.save()
println 'rate limit checker: ' + c.getApiRateLimitChecker()
