#!/bin/bash

###
# Updates the AWS CloudFormation Resource Specification using the files published on the AWS Documentaiton.
# See: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-resource-specification.html
###

set -euo pipefail
scriptdir=$(cd $(dirname $0) && pwd)

rm -f CHANGELOG.md.new


# update-spec <TITLE> <SOURCE> <TARGETDIR> <IS_GZIPPED> <SHOULD_SPLIT> [<SVC> [...]]
function update-spec() {
    local title=$1
    local url=$2
    local targetdir=$3
    local gunzip=$4
    local split=$5

    local tmpdir="$(mktemp -d)"
    local newspec="${tmpdir}/new_proposed.json"
    local newcombined="${tmpdir}/new.json"
    local oldcombined="${tmpdir}/old.json"

    # fail if the spec has changes, otherwise we won't be able to determine the diff
    if [ -n "$(git status --porcelain ${targetdir})" ]; then
        echo "The directory ${targetdir} has changes, revert them before cfn-update"
        exit 1
    fi

    if [[ "${url}" == "http"* ]]; then
        echo >&2 "Downloading from ${url}..."
        if ${gunzip}; then
            curl -sL "${url}" | gunzip - > ${newspec}
        else
            curl -sL "${url}" > ${newspec}
        fi
    else
        echo >&2 "Copying file ${url}..."
        cp "${url}" "${newspec}"
    fi

    # Calculate the old and new combined specs, so we can do a diff on the changes
    echo >&2 "Updating source spec..."

    ts-node --preferTsExts build-tools/patch-set.ts --quiet "${targetdir}" "${oldcombined}"
    if ${split}; then
        ts-node --preferTsExts build-tools/split-spec-by-service.ts "${newspec}" "${targetdir}" "${services}"
    else
        cp "${newspec}" "${targetdir}/spec.json"
        sort-json "${targetdir}/spec.json"
    fi
    ts-node --preferTsExts build-tools/patch-set.ts --quiet "${targetdir}" "${newcombined}"

    echo >&2 "Updating CHANGELOG.md..."
    ts-node --preferTsExts build-tools/spec-diff.ts "${title}" "${oldcombined}" "${newcombined}" >> CHANGELOG.md.new

    echo "" >> CHANGELOG.md.new
}

# First run a build to get a complete version of the old spec

update-spec \
    "CloudFormation Resource Specification" \
    "${1:-https://d1uauaxba7bl26.cloudfront.net/latest/gzip/CloudFormationResourceSpecification.json}" \
    spec-source/specification/000_cfn/000_official \
    true true

old_version=$(cat cfn.version)
new_version=$(node -p "require('${scriptdir}/../spec-source/specification/000_cfn/000_official/001_Version.json').ResourceSpecificationVersion")
echo >&2 "Recording new version..."
rm -f cfn.version
echo "$new_version" > cfn.version

# Only report outdated specs if we made changes, otherwise we're stuck reporting changes every time.
if [[ "$new_version" != "$old_version" ]]; then
    echo >&2 "Reporting outdated specs..."
    node build-tools/report-issues spec-source/specification/000_cfn/000_official/ outdated >> CHANGELOG.md.new
    ts-node --preferTsExts build-tools/report-issues spec-source/specification/000_cfn/000_official/ outdated >> CHANGELOG.md.new
    ts-node --preferTsExts build-tools/report-issues spec-source/specification/001_cfn_us-west-2/000_official/ outdated >> CHANGELOG.md.new
fi

update-spec \
    "Serverless Application Model (SAM) Resource Specification" \
    "https://raw.githubusercontent.com/awslabs/goformation/master/generate/sam-2016-10-31.json" \
    spec-source/specification/100_sam/000_official \
    false false

npm run build

# append old changelog after new and replace as the last step because otherwise we will not be idempotent
_changelog_contents=$(cat CHANGELOG.md.new)
if [ -n "${_changelog_contents}" ]; then
    cat CHANGELOG.md >> CHANGELOG.md.new
    cp CHANGELOG.md.new CHANGELOG.md
fi

exec /bin/bash ${scriptdir}/update-cfnlint.sh
